export const CLASS_ORDER = ['feet', 'left_hand', 'right_hand', 'tongue'] as const

export type ClassName = (typeof CLASS_ORDER)[number]

export interface ReplayTrial {
  trialIndex: number
  run: string
  trueLabel: ClassName
  predictedLabel: ClassName
  scores: Array<{
    classId: number
    className: ClassName
    logit: number
  }>
  waveformPreview: {
    channelNames: string[]
    windowEndSeconds: number
    timesSeconds: number[]
    channels: number[][]
  }
}

export interface ReplayExport {
  dataset: string
  datasetId: string
  participant: number
  session: string
  run: string
  recording: string
  channelMetadata: {
    displayChannels: string[]
    unit: string
    displaySamplingHz: number
  }
  classMapping: Array<{
    classId: number
    className: ClassName
  }>
  trials: ReplayTrial[]
}

export interface ReplaySummary {
  total: number
  correct: number
  accuracy: number
  support: Record<ClassName, number>
  confusionMatrix: number[][]
}

export function parseReplayExport(value: unknown): ReplayExport {
  if (!value || typeof value !== 'object') {
    throw new Error('The bundled validation export is not a valid JSON object.')
  }

  const data = value as ReplayExport
  const classMappingIsValid =
    Array.isArray(data.classMapping) &&
    data.classMapping.length === CLASS_ORDER.length &&
    data.classMapping.every(
      (item, index) => item.classId === index && item.className === CLASS_ORDER[index],
    )

  if (
    data.datasetId !== 'BNCI2014_001' ||
    data.participant !== 1 ||
    data.session !== '0train' ||
    data.run !== '5' ||
    !classMappingIsValid ||
    !Array.isArray(data.trials) ||
    data.trials.length === 0
  ) {
    throw new Error('The bundled export does not match the supported validation recording.')
  }

  data.trials.forEach((trial) => {
    const { channelNames, channels, timesSeconds } = trial.waveformPreview
    const scoresAreValid =
      trial.scores.length === CLASS_ORDER.length &&
      trial.scores.every(
        (score, index) =>
          score.classId === index &&
          score.className === CLASS_ORDER[index] &&
          Number.isFinite(score.logit),
      )
    const waveformsAreValid =
      channelNames.length === 8 &&
      channels.length === channelNames.length &&
      timesSeconds.length > 1 &&
      Number.isFinite(trial.waveformPreview.windowEndSeconds) &&
      trial.waveformPreview.windowEndSeconds > timesSeconds[timesSeconds.length - 1] &&
      channels.every((channel) => channel.length === timesSeconds.length)

    if (
      !CLASS_ORDER.includes(trial.trueLabel) ||
      !CLASS_ORDER.includes(trial.predictedLabel) ||
      !scoresAreValid ||
      !waveformsAreValid
    ) {
      throw new Error(`Trial ${trial.trialIndex + 1} is incomplete or has an invalid class order.`)
    }
  })

  return data
}

export function getReplaySummary(trials: ReplayTrial[]): ReplaySummary {
  const support = Object.fromEntries(CLASS_ORDER.map((label) => [label, 0])) as Record<
    ClassName,
    number
  >
  const confusionMatrix = CLASS_ORDER.map(() => CLASS_ORDER.map(() => 0))
  let correct = 0

  trials.forEach((trial) => {
    const trueIndex = CLASS_ORDER.indexOf(trial.trueLabel)
    const predictedIndex = CLASS_ORDER.indexOf(trial.predictedLabel)
    support[trial.trueLabel] += 1
    confusionMatrix[trueIndex][predictedIndex] += 1
    if (trueIndex === predictedIndex) correct += 1
  })

  return {
    total: trials.length,
    correct,
    accuracy: trials.length === 0 ? 0 : correct / trials.length,
    support,
    confusionMatrix,
  }
}

export interface PlaybackState {
  selectedIndex: number
  isPlaying: boolean
  currentTime: number
  speed: number
}

export type PlaybackAction =
  | { type: 'toggle'; startTime: number; endTime: number }
  | { type: 'pause' }
  | { type: 'restart'; startTime: number }
  | { type: 'select'; index: number; startTime: number }
  | { type: 'previous'; startTime: number }
  | { type: 'next'; startTime: number }
  | { type: 'tick'; deltaSeconds: number; endTime: number }
  | { type: 'speed'; speed: number }

export function createPlaybackState(startTime: number): PlaybackState {
  return { selectedIndex: 0, isPlaying: false, currentTime: startTime, speed: 1 }
}

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'toggle':
      return state.isPlaying
        ? { ...state, isPlaying: false }
        : {
            ...state,
            currentTime:
              state.currentTime >= action.endTime ? action.startTime : state.currentTime,
            isPlaying: true,
          }
    case 'pause':
      return { ...state, isPlaying: false }
    case 'restart':
      return { ...state, isPlaying: false, currentTime: action.startTime }
    case 'select':
      return {
        ...state,
        selectedIndex: action.index,
        isPlaying: false,
        currentTime: action.startTime,
      }
    case 'previous':
      return {
        ...state,
        selectedIndex: Math.max(0, state.selectedIndex - 1),
        isPlaying: false,
        currentTime: action.startTime,
      }
    case 'next':
      return {
        ...state,
        selectedIndex: state.selectedIndex + 1,
        isPlaying: false,
        currentTime: action.startTime,
      }
    case 'tick': {
      const currentTime = Math.min(action.endTime, state.currentTime + action.deltaSeconds)
      return {
        ...state,
        currentTime,
        isPlaying: currentTime < action.endTime,
      }
    }
    case 'speed':
      return { ...state, speed: action.speed }
  }
}
