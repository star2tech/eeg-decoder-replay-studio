# EEG Decoder Replay Studio

A standalone React/Vite viewer for replaying a locally supplied export of
precomputed BCI Competition IV-2a (BNCI2014_001) motor-imagery predictions.
The public repository contains the replay software only. Users must import a
compatible local replay JSON file to see trial data. The model does not run in
the browser.

> **Recorded EEG replay—not live brain monitoring.** This project classifies
> four motor-imagery labels. It does not decode words, sentences, or arbitrary
> thoughts.

The checkpoint and source recordings are not bundled. Replay data must be
generated locally from data and a compatible checkpoint that you are authorized
to use, then imported with the file picker. The replay file stays in browser
memory and is not included in the production build. A fresh clone cannot
reproduce inference without those source recordings and compatible checkpoint
assets.

## Screenshot

![Screenshot of dashboard or studio](https://imgur.com/a/eeg-replay-studio-zA6RBcg#xFUMTbi "Studio")

## Run locally

Requirements: a current Node.js release and npm.

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. With no replay data bundled, the page
explains how to import a locally generated JSON export.

To check the code:

```powershell
npm test
npm run lint
npm run build
```

## Local replay data

The interface accepts the validation JSON format produced by
`eeg-research/export_validation_replay.py`. It validates the dataset identifier,
participant/session/run, class ordering, score shapes, and waveform data before
displaying anything.

To generate an export, you need:

1. The original BNCI2014_001 files obtained directly from an authorized source,
   subject to that source's terms.
2. The matching locally available trained checkpoint at the path expected by
   the exporter. This repository does not include that checkpoint, training
   artifacts, or source recordings.
3. The Python environment and versions recorded in
   [DATA_SOURCES.md](./DATA_SOURCES.md).

The included exporter does not train a model, and this repository does not
include the training script or checkpoint needed to create one. Therefore, a
fresh clone cannot generate a replay export by itself; the compatible
checkpoint must be obtained or recreated separately and lawfully.

From the project root, after placing the authorized participant-1 training
recording in the MNE cache and providing the matching checkpoint/configuration.
The exporter uses the configured MNE data directory (`MNE_DATA`, or MNE's
default user data directory) and paths relative to this repository; no
machine-specific absolute paths are required.

```powershell
python eeg-research/export_validation_replay.py --output .\local-data\validation_trials.json
```

The exporter writes to the ignored `local-data/validation_trials.json` by
default. It performs inference only, does not train, and does not download data.
Select that file in the browser's **Import local replay JSON** control. If the
required data or checkpoint are unavailable, no waveform or prediction is
fabricated as a fallback. The exporter only performs inference with an
existing compatible checkpoint; this repository does not include the training
script or weights needed to create one.

The browser uses precomputed trial-level model outputs. It does not run
ShallowFBCSPNet, and playback speed changes only the replay animation.

## Dataset, model, and reported validation result

- **Dataset:** BCI Competition IV Dataset 2a, MOABB identifier
  `BNCI2014_001`; participant 1, training session `0train`, whole validation
  run 5. The evaluation session was not used for this replay.
- **Model:** the existing project-trained `ShallowFBCSPNet` checkpoint,
  selected at epoch 20 by validation loss. The checkpoint itself is excluded.
- **Preprocessing:** EEG-channel selection; volts-to-microvolts conversion;
  4–38 Hz bandpass; exponential moving standardization
  (`factor_new=0.001`, `init_block_size=1000`). The displayed eight-channel,
  50 Hz preview is standardized units and display-downsampled; the model input
  used all 22 EEG channels at 250 Hz.
- **Previously reported validation result:** 26/48 trials correct (54.17%),
  derived from that validation run's precomputed predictions. This is not
  independent final-test performance and is not a result reproduced by this
  code-only repository unless the matching local artifacts are provided.
- **Scores:** four raw logits in the order feet, left hand, right hand, tongue;
  they are not calibrated confidence values.

Validation uses data involved in development and checkpoint selection. It
does not establish generalization to other runs or people. This is motor-
imagery class prediction, not thought-to-text or intention decoding.

## Publication contents

The standalone source currently includes:

- Replay React interface, contextual explanations, styles, and components.
- Test-only synthetic fixture code used by automated UI tests; it is not
  shipped in the application or used as an example replay.
- Web package manifest/lockfile, TypeScript/Vite/Oxlint configuration.
- Inference/export script and experiment configuration metadata.
- Dataset sourcing and attribution notes in `DATA_SOURCES.md`.

Excluded: task dashboard/parser, task-management code, `node_modules`, build
output, Python environments/caches, raw recordings, validation replay JSON,
checkpoint weights, and unrelated experiment outputs.

No project source-code license has been selected here. A future source-code
license would not automatically apply to third-party data, model weights, or
assets. See [DATA_SOURCES.md](./DATA_SOURCES.md) for the open data
redistribution question. No GitHub repository has been created; review the
publication file list before publishing.
