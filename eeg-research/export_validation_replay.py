"""Export participant 1's cached BNCI2014_001 validation run for local replay.

This script performs inference only. It never opens session 1test, downloads
data, or trains the saved model.
"""

import argparse
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import braindecode
import mne
import moabb
import numpy as np
import sklearn
import torch
from braindecode.datasets.base import BaseConcatDataset, BaseDataset
from braindecode.datasets.moabb import _annotations_from_moabb_stim_channel
from braindecode.models import ShallowFBCSPNet
from braindecode.preprocessing import (
    Preprocessor,
    create_windows_from_events,
    exponential_moving_standardize,
)
from braindecode.preprocessing.preprocess import preprocess
from moabb.datasets.bnci import BNCI2014_001
from moabb.datasets.bnci.base import _convert_mi
from sklearn.metrics import confusion_matrix


ROOT = Path(__file__).resolve().parent
EXPERIMENT = (
    ROOT
    / "experiments"
    / "bnci2014_001_subject01_baseline_20_epochs_20261025"
)
DEFAULT_OUTPUT = ROOT.parent / "local-data" / "validation_trials.json"
SUBJECT = 1
VALIDATION_RUN = "5"
START_OFFSET_SAMPLES = -125
STOP_OFFSET_SAMPLES = 0
LOW_CUT_HZ = 4.0
HIGH_CUT_HZ = 38.0
DISPLAY_CHANNELS = ["Fz", "FC3", "C3", "Cz", "C4", "CPz", "Pz", "POz"]
DISPLAY_SAMPLE_STRIDE = 5


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main(output_path: Path) -> None:
    config_path = EXPERIMENT / "config.json"
    checkpoint_path = EXPERIMENT / "best_model.pt"
    mat_path = (
        Path(mne.get_config("MNE_DATA") or Path.home() / "mne_data")
        / "MNE-bnci-data"
        / "~bci"
        / "database"
        / "001-2014"
        / "A01T.mat"
    )
    for path in (config_path, checkpoint_path, mat_path):
        if not path.is_file():
            raise FileNotFoundError(f"Required cached artifact is missing: {path}")

    config = json.loads(config_path.read_text(encoding="utf-8"))
    if config["moabb_identifier"] != "BNCI2014_001" or config["subject_id"] != SUBJECT:
        raise ValueError("This replay exporter supports only BNCI2014_001 subject 1.")
    if config["split"]["validation_runs"] != [VALIDATION_RUN]:
        raise ValueError(
            f"Expected validation run {VALIDATION_RUN}, found "
            f"{config['split']['validation_runs']}"
        )
    if config["split"]["evaluation_session_used"]:
        raise ValueError("The saved experiment unexpectedly used the evaluation session.")

    channel_names = [
        "Fz", "FC3", "FC1", "FCz", "FC2", "FC4", "C5", "C3", "C1", "Cz", "C2",
        "C4", "C6", "CP3", "CP1", "CPz", "CP2", "CP4", "P1", "Pz", "P2", "POz",
        "EOG1", "EOG2", "EOG3",
    ]
    raws, _event_id = _convert_mi(
        str(mat_path),
        channel_names,
        ["eeg"] * 22 + ["eog"] * 3,
        dataset_code="BNCI2014-001",
        subject_id=SUBJECT,
        artifact_interval=(2, 6),
    )
    if len(raws) != 6:
        raise RuntimeError(f"Expected six 0train runs, found {len(raws)}.")

    moabb_dataset = BNCI2014_001()
    for raw in raws:
        raw.set_annotations(_annotations_from_moabb_stim_channel(raw, moabb_dataset))

    training_session = BaseConcatDataset(
        [
            BaseDataset(
                raw,
                description={
                    "subject": SUBJECT,
                    "session": "0train",
                    "run": str(run_index),
                },
            )
            for run_index, raw in enumerate(raws)
        ]
    )
    preprocess(
        training_session,
        [
            Preprocessor("pick", picks="eeg"),
            Preprocessor(lambda data: np.multiply(data, 1e6)),
            Preprocessor("filter", l_freq=LOW_CUT_HZ, h_freq=HIGH_CUT_HZ),
            Preprocessor(
                exponential_moving_standardize,
                factor_new=1e-3,
                init_block_size=1000,
            ),
        ],
    )
    windows = create_windows_from_events(
        training_session,
        trial_start_offset_samples=START_OFFSET_SAMPLES,
        trial_stop_offset_samples=STOP_OFFSET_SAMPLES,
        preload=True,
        on_last_window="drop",
    )

    mapping = windows.datasets[0].window_kwargs[0][1]["mapping"]
    ordered_mapping = sorted(mapping.items(), key=lambda item: item[1])
    class_names = [name for name, _ in ordered_mapping]
    class_ids = [class_id for _, class_id in ordered_mapping]
    saved_mapping = {name: index for name, index in config["labels"].items()}
    if {name: index for name, index in ordered_mapping} != saved_mapping:
        raise RuntimeError(
            f"Preprocessed label mapping {mapping} does not match checkpoint "
            f"mapping {config['labels']}."
        )

    runs = windows.split("run")
    if sorted(runs) != [str(index) for index in range(6)]:
        raise RuntimeError(f"Expected 0train runs 0-5, found {sorted(runs)}.")
    validation = runs[VALIDATION_RUN]
    if len(validation) == 0:
        raise RuntimeError("Validation run 5 contains no windows.")

    model_config = config["model"]
    model = ShallowFBCSPNet(
        **{key: value for key, value in model_config.items() if key != "type"}
    )
    checkpoint = torch.load(
        checkpoint_path,
        map_location="cpu",
        weights_only=True,
    )
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    model.eval()

    sample_rate = float(config["trial_window"]["sampling_rate_hz"])
    model_sample_count = int(config["trial_window"]["n_times"])
    if sample_rate != 250.0 or model_sample_count != 1125:
        raise RuntimeError(
            f"Unexpected saved model input: {sample_rate} Hz, "
            f"{model_sample_count} samples."
        )
    preview_indices = [
        channel_names.index(name) for name in DISPLAY_CHANNELS
    ]
    trials = []
    true_labels = []
    predictions = []

    with torch.inference_mode():
        for trial_index in range(len(validation)):
            model_input, target, *_ = validation[trial_index]
            model_input = np.asarray(model_input, dtype=np.float32)
            if model_input.shape != (22, model_sample_count):
                raise RuntimeError(
                    f"Trial {trial_index} has input shape {model_input.shape}; "
                    f"expected (22, {model_sample_count})."
                )
            logits = model(torch.from_numpy(model_input[None, ...])).squeeze(0)
            scores = logits.cpu().numpy()
            if scores.shape != (len(class_names),) or not np.isfinite(scores).all():
                raise RuntimeError(
                    f"Trial {trial_index} produced invalid model scores: {scores}."
                )

            target_id = int(target)
            predicted_id = int(np.argmax(scores))
            if target_id not in class_ids or predicted_id not in class_ids:
                raise RuntimeError(
                    f"Trial {trial_index} has an unmapped target or prediction."
                )
            true_labels.append(target_id)
            predictions.append(predicted_id)

            preview = model_input[
                preview_indices, ::DISPLAY_SAMPLE_STRIDE
            ]
            times = (
                np.arange(preview.shape[1], dtype=np.float64)
                * DISPLAY_SAMPLE_STRIDE
                / sample_rate
                + START_OFFSET_SAMPLES / sample_rate
            )
            trials.append(
                {
                    "trialIndex": trial_index,
                    "run": VALIDATION_RUN,
                    "trueLabel": class_names[class_ids.index(target_id)],
                    "predictedLabel": class_names[class_ids.index(predicted_id)],
                    "scores": [
                        {
                            "classId": class_id,
                            "className": class_name,
                            "logit": float(scores[class_id]),
                        }
                        for class_name, class_id in ordered_mapping
                    ],
                    "waveformPreview": {
                        "channelNames": DISPLAY_CHANNELS,
                        "windowEndSeconds": (
                            START_OFFSET_SAMPLES / sample_rate
                            + model_sample_count / sample_rate
                        ),
                        "timesSeconds": [round(float(value), 6) for value in times],
                        "channels": [
                            [round(float(value), 5) for value in row]
                            for row in preview
                        ],
                    },
                }
            )

    if len(trials) != len(validation):
        raise RuntimeError(
            f"Exported {len(trials)} of {len(validation)} validation trials."
        )
    if Counter(true_labels) != Counter(
        validation.get_metadata()["target"].to_list()
    ):
        raise RuntimeError("Exported labels do not account for every validation trial.")

    matrix = confusion_matrix(true_labels, predictions, labels=class_ids)
    metadata = {
        "dataset": "BCI Competition IV Dataset 2a",
        "datasetId": "BNCI2014_001",
        "participant": 1,
        "session": "0train",
        "run": VALIDATION_RUN,
        "recording": "Participant 1, training session, validation run 5",
        "provenance": {
            "checkpoint": str(checkpoint_path.relative_to(ROOT)).replace("\\", "/"),
            "checkpointSha256": sha256_file(checkpoint_path),
            "checkpointEpoch": int(checkpoint["epoch"]),
            "checkpointValidationLoss": float(checkpoint["validation_loss"]),
            "sourceMat": "MNE BNCI cache / A01T.mat (training session only)",
            "sourceMatSha256": sha256_file(mat_path),
            "evaluationSessionLoaded": False,
            "trainingPerformed": False,
            "preprocessing": [
                "Pick EEG channels",
                "Convert volts to microvolts (multiply by 1e6)",
                "Bandpass filter 4-38 Hz",
                "Exponential moving standardization (factor_new=0.001, init_block_size=1000)",
                "Window start -125 samples relative to event; stop offset 0 samples",
            ],
            "python": sys.version.split()[0],
            "torch": torch.__version__,
            "braindecode": braindecode.__version__,
            "moabb": moabb.__version__,
            "mne": mne.__version__,
            "scikitLearn": sklearn.__version__,
        },
        "classMapping": [
            {"classId": class_id, "className": class_name}
            for class_name, class_id in ordered_mapping
        ],
        "channelMetadata": {
            "names": channel_names[:22],
            "types": ["eeg"] * 22,
            "unit": "standardized units",
            "displayChannels": DISPLAY_CHANNELS,
            "modelInputChannelCount": 22,
            "modelInputSamplingHz": sample_rate,
            "modelInputSamplesPerTrial": model_sample_count,
            "modelWindowStartSeconds": START_OFFSET_SAMPLES / sample_rate,
            "modelWindowDurationSeconds": model_sample_count / sample_rate,
            "displaySampleStride": DISPLAY_SAMPLE_STRIDE,
            "displaySamplingHz": sample_rate / DISPLAY_SAMPLE_STRIDE,
            "displayDownsamplingAppliedToModelInput": False,
        },
        "summary": {
            "trialCount": len(trials),
            "accuracy": float(np.mean(np.asarray(true_labels) == np.asarray(predictions))),
            "confusionMatrix": matrix.tolist(),
            "confusionMatrixLabelOrder": class_names,
            "classCounts": {
                name: int(sum(label == class_id for label in true_labels))
                for name, class_id in ordered_mapping
            },
        },
        "trials": trials,
    }

    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        raise FileExistsError(f"Refusing to overwrite replay export: {output_path}")
    output_path.write_text(
        json.dumps(metadata, separators=(",", ":"), ensure_ascii=False),
        encoding="utf-8",
    )
    print("Exported validation trials:", len(trials))
    print("Label mapping:", config["labels"])
    print("Validation accuracy (derived from inference):", metadata["summary"]["accuracy"])
    print("Confusion matrix:", matrix.tolist())
    print("Replay export:", output_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    main(parser.parse_args().output)
