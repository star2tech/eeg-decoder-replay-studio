export const EXPLANATIONS = {
  recording: {
    title: 'Supported recording',
    body: 'This bundled recording is BCI Competition IV-2a (BNCI2014_001), participant 1, session 0train, validation run 5, with 48 trials. It is the only supported recording; the selector does not load arbitrary recordings.',
  },
  participant: {
    title: 'Participant',
    body: 'Participant 1 is the dataset identifier for this recording. This single-participant validation replay does not establish generalization to other participants.',
  },
  sessionRun: {
    title: 'Session and run',
    body: 'A session contains runs, and a run contains multiple trials. This is session 0train, validation run 5; each trial is one recorded motor-imagery task example.',
  },
  trial: {
    title: 'Trial',
    body: 'A trial is one recorded motor-imagery task example. Selecting another trial changes the displayed recording and its already-computed result.',
  },
  playback: {
    title: 'Playback controls',
    body: 'Play, pause, restart, and previous/next move through these recorded samples. Playback does not rerun inference; the saved prediction was computed before this replay.',
  },
  playbackSpeed: {
    title: 'Playback speed',
    body: 'Speed changes only how quickly the recorded playback cursor moves. It does not alter EEG samples, model scores, or predictions.',
  },
  motorImagery: {
    title: 'Motor-imagery classification',
    body: 'The model classifies four recorded motor-imagery task labels: feet, left hand, right hand, and tongue. The actual label is the dataset task label, not evidence of exactly what the participant thought.',
  },
  eegSignals: {
    title: 'EEG signals',
    body: 'These traces are recorded EEG after preprocessing and exponential moving standardization. The chart previews eight named channels using every fifth exported sample (50 Hz display); inference used all 22 channels. One point does not identify a thought or movement.',
  },
  channel: {
    title: 'Channel',
    body: 'Choose one of the eight named channels in the display-only waveform preview. These are selected channels from the recording; no electrode-location claim is implied.',
  },
  signalAxis: {
    title: 'Signal axis',
    body: 'Each trace is centered in its own lane. Vertical deflection shows the standardized signal value, with a visual scale for readability; values are not microvolts and separate lanes are not a shared electrode-position map.',
  },
  timeAxis: {
    title: 'Time axis',
    body: 'Time is event-relative as exported: samples start at −0.50 s and the final displayed sample is 3.98 s; the continuous model window ends at 4.00 s. Zero is not identified here as cue onset.',
  },
  modelInput: {
    title: 'Model input',
    body: 'The model received all 22 EEG channels at 250 Hz for 1,125 samples (4.5 seconds, from −0.5 s to the 4.0 s window endpoint). Display downsampling applies only to the plotted preview.',
  },
  pointInspection: {
    title: 'Selected waveform point',
    body: 'The readout reports the exact exported preview sample for the selected channel and time, in standardized units after preprocessing. It is a signal measurement, not a decoded thought or movement.',
  },
  precomputed: {
    title: 'Precomputed prediction',
    body: 'All 48 model predictions were computed before browser playback using the saved trained model. Replaying a trial only animates the recording; it does not run live inference.',
  },
  predictedClass: {
    title: 'Predicted class',
    body: 'This is the saved ShallowFBCSPNet classifier’s selected motor-imagery label for the trial. It is not a word, sentence, or unrestricted intention.',
  },
  actualClass: {
    title: 'Actual class',
    body: 'This is the dataset’s recorded/instructed task label for the trial. It is not evidence of exactly what the participant thought.',
  },
  correctness: {
    title: 'Correctness',
    body: 'Correct means the predicted class matches the dataset’s actual task label. Incorrect means those two labels differ; the comparison does not reveal what the participant privately thought.',
  },
  logits: {
    title: 'Model scores (logits)',
    body: 'These four raw scores are ordered feet, left hand, right hand, tongue. The largest score determines the predicted class. No softmax is applied: logits are not probabilities, calibrated confidence, or values that sum to 100%.',
  },
  accuracy: {
    title: 'Validation accuracy',
    body: 'Accuracy is the number of correct predictions divided by the number of validation trials shown. It is not a running playback subset score or independent final-test result.',
  },
  confusionMatrix: {
    title: 'Confusion matrix',
    body: 'Rows are the actual (dataset) class and columns are the predicted class. Each cell counts validation trials for that actual/predicted pair; diagonal cells are matches and off-diagonal cells are errors.',
  },
  validation: {
    title: 'Validation scope',
    body: 'These predictions are from participant 1, session 0train, validation run 5. Validation informed model development and checkpoint selection; the independent evaluation session was excluded and is not represented here.',
  },
  model: {
    title: 'Model and checkpoint',
    body: 'The saved model is ShallowFBCSPNet, trained in this project and selected at epoch 20 based on validation loss. An epoch is one pass through the training examples; validation helped select the checkpoint.',
  },
} as const

export type ExplanationTopic = keyof typeof EXPLANATIONS
