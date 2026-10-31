import { CLASS_ORDER, type ClassName, type ReplayExport } from './replayData'

// Test-only synthetic interface example: not recorded EEG and not evidence of trained-model performance.
export function createSyntheticReplayFixture(): ReplayExport {
  const timesSeconds = Array.from({ length: 225 }, (_, index) =>
    Number((-0.5 + index * 0.02).toFixed(2)),
  )
  const channelNames = ['Fz', 'FC3', 'C3', 'Cz', 'C4', 'CPz', 'Pz', 'POz']
  const labels: ClassName[] = ['left_hand', 'feet', 'right_hand', 'tongue']
  const predictions: ClassName[] = ['right_hand', 'feet', 'right_hand', 'feet']
  const logitRows = [
    [-0.8, 0.6, 1.2, -1.5],
    [1.1, 0.2, -0.1, -0.4],
    [-0.5, 0.1, 1.4, -0.3],
    [0.8, -0.2, -0.4, 0.5],
  ]

  return {
    dataset: 'Synthetic interface test only',
    datasetId: 'BNCI2014_001',
    participant: 1,
    session: '0train',
    run: '5',
    recording:
      'Synthetic interface example—not recorded EEG and not evidence of trained-model performance.',
    channelMetadata: {
      displayChannels: channelNames,
      unit: 'standardized units',
      displaySamplingHz: 50,
    },
    classMapping: CLASS_ORDER.map((className, classId) => ({ classId, className })),
    trials: labels.map((trueLabel, trialIndex) => ({
      trialIndex,
      run: '5',
      trueLabel,
      predictedLabel: predictions[trialIndex],
      scores: CLASS_ORDER.map((className, classId) => ({
        classId,
        className,
        logit: logitRows[trialIndex][classId],
      })),
      waveformPreview: {
        channelNames,
        windowEndSeconds: 4,
        timesSeconds,
        channels: channelNames.map((_, channelIndex) =>
          timesSeconds.map((_, sampleIndex) =>
            Number((Math.sin(sampleIndex / 7 + channelIndex) * 0.25).toFixed(5)),
          ),
        ),
      },
    })),
  }
}
