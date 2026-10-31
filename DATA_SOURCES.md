# Data sources, provenance, and attribution

## Dataset

- Name: **BCI Competition IV Dataset 2a**, also known as **BNCI2014_001**.
- Original competition page: <https://www.bbci.de/competition/iv/>
- Dataset description: <https://www.bbci.de/competition/iv/desc_2a.pdf>
- MOABB dataset documentation and metadata:
  <https://moabb.neurotechx.com/docs/generated/moabb.datasets.BNCI2014_001.html>
- The official competition page identifies the dataset as four-class cued
  motor imagery, with 22 EEG channels, 3 EOG channels, 250 Hz sampling, and
  nine participants.
- The competition page credits the Institute for Knowledge Discovery,
  Laboratory of Brain-Computer Interfaces, Graz University of Technology,
  including Clemens Brunner, Robert Leeb, Gernot Müller-Putz, Alois Schlögl,
  and Gert Pfurtscheller as dataset providers.
- MOABB's dataset metadata reports **CC BY-ND 4.0**. The official competition
  page requests attribution to the recording group and citation of one of the
  papers listed in the dataset description.

## Redistribution status

The dataset-derived replay JSON is intentionally not included. It contains
processed EEG waveform samples, labels, and outputs from the saved model.
MOABB's reported CC BY-ND 4.0 metadata and the original competition page do
not, by themselves, resolve whether redistribution of this transformed
participant-level export is permitted. Confirm the applicable terms with the
dataset rights holder/source before distributing replay JSON, raw recordings,
or other derivatives.

This repository does not choose or apply a license to third-party data,
trained model artifacts, or assets. No data or model artifacts should be
added to a public repository until their redistribution rights are confirmed.

## Local export provenance and processing

The included `eeg-research/export_validation_replay.py` is an inference-only
exporter for the existing participant-1 checkpoint. It expects authorized,
locally available `A01T.mat` training-session data, a compatible checkpoint,
and the experiment configuration. It does not download data, train a model,
or load the `1test` evaluation session. By default it writes to the ignored
`local-data/validation_trials.json`; the user can import that file in the
browser.

The saved experiment's recorded pipeline is:

1. Pick EEG channels.
2. Convert volts to microvolts (multiply by `1e6`).
3. Bandpass filter from 4 to 38 Hz.
4. Apply exponential moving standardization (`factor_new=0.001`,
   `init_block_size=1000`).
5. Window each event from 125 samples before the event to the configured
   zero stop offset, yielding 1,125 samples at 250 Hz.
6. Run the existing ShallowFBCSPNet checkpoint on all 22 channels; export
   eight selected channels downsampled for display only, with actual event-
   relative timestamps and standardized values.

This pipeline description does not grant permission to redistribute its
inputs or outputs.

## Required attribution and citation

For publications analyzing this dataset, follow the BCI Competition IV
instructions: acknowledge the group(s) that recorded the data and cite one of
the papers listed in the official Dataset 2a description. Consult the current
official description for the complete citation and attribution requirements.
MOABB is the software dataset interface, not a substitute for citing the
dataset originators.

The MOABB dataset page lists this review citation:

> Tangermann, M., Müller, K.-R., Aertsen, A., et al. (2012). Review of the BCI
> Competition IV. *Frontiers in Neuroscience, 6*, 55.
> <https://doi.org/10.3389/fnins.2012.00055>

Verify the official Dataset 2a description's current citation requirements
before publication; the competition asks authors to cite one of the papers
listed there.

## Recorded environment

The original export metadata records Python 3.14.6, PyTorch 2.14.1+cpu,
Braindecode 1.8.1, MOABB 1.7.2, MNE 1.13.2, and scikit-learn 1.9.1. These
versions document the existing experiment; they do not imply that the model
checkpoint is included or that a fresh export has been reproduced here.
