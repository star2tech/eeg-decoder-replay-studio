import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  CLASS_ORDER,
  createPlaybackState,
  getReplaySummary,
  parseReplayExport,
  playbackReducer,
  type ClassName,
  type ReplayExport,
  type ReplayTrial,
} from './replayData'
import Explanation from './Explanation'
import './Replay.css'

const CLASS_COLORS: Record<ClassName, string> = {
  feet: '#e8b36b',
  left_hand: '#b7a0f4',
  right_hand: '#7ac9a7',
  tongue: '#f18d7d',
}
const PLAYBACK_SPEEDS = [0.5, 1, 2]

function formatTime(seconds: number): string {
  return `${seconds < 0 ? '−' : ''}${Math.abs(seconds).toFixed(2)} s`
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('The selected file could not be read as text.'))
    }
    reader.onerror = () => reject(new Error('The selected file could not be read.'))
    reader.readAsText(file)
  })
}

function getTrialBounds(trial: ReplayTrial) {
  const times = trial.waveformPreview.timesSeconds
  return {
    startTime: times[0],
    endTime: trial.waveformPreview.windowEndSeconds,
  }
}

function findNearestSampleIndex(timesSeconds: number[], timeSeconds: number): number {
  let low = 0
  let high = timesSeconds.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (timesSeconds[middle] < timeSeconds) low = middle + 1
    else high = middle
  }
  if (low === 0) return 0
  return timeSeconds - timesSeconds[low - 1] <= timesSeconds[low] - timeSeconds
    ? low - 1
    : low
}

function SignalViewer({
  trial,
  currentTime,
  completed,
  modelInput,
}: {
  trial: ReplayTrial
  currentTime: number
  completed: boolean
  modelInput: ReplayExport['channelMetadata']
}) {
  const { channelNames, channels, timesSeconds } = trial.waveformPreview
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0)
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0)
  const start = timesSeconds[0]
  const end = trial.waveformPreview.windowEndSeconds
  const width = 1000
  const left = 72
  const right = 18
  const chartWidth = width - left - right
  const laneHeight = 38
  const chartHeight = laneHeight * channels.length
  const cursorX = left + ((currentTime - start) / (end - start)) * chartWidth
  const ticks = [-0.5, 0, 1, 2, 3, 4].filter((tick) => tick >= start && tick <= end)
  const selectedTime = timesSeconds[selectedSampleIndex]
  const selectedValue = channels[selectedChannelIndex][selectedSampleIndex]
  const selectedCenter = 18 + selectedChannelIndex * laneHeight + laneHeight / 2
  const selectedX = left + ((selectedTime - start) / (end - start)) * chartWidth
  const selectedY = selectedCenter - selectedValue * 3.5

  const selectAtPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = ((event.clientX - rect.left) / rect.width) * width
    const y = ((event.clientY - rect.top) / rect.height) * (chartHeight + 34)
    const targetTime = start + ((x - left) / chartWidth) * (end - start)
    const laneIndex = Math.round((y - 18 - laneHeight / 2) / laneHeight)
    setSelectedSampleIndex(findNearestSampleIndex(timesSeconds, targetTime))
    setSelectedChannelIndex(Math.max(0, Math.min(channelNames.length - 1, laneIndex)))
  }

  return (
    <>
      <div className="signal-axis-notes">
        <span className="explanation-label">Time (event-relative, s) <Explanation topic="timeAxis" /></span>
        <span className="explanation-label">Standardized signal <Explanation topic="signalAxis" /></span>
      </div>
      <div className="signal-chart-wrap">
        <svg
          className="signal-chart"
          viewBox={`0 0 ${width} ${chartHeight + 34}`}
          role="img"
          aria-label={`Interactive EEG waveform preview for trial ${trial.trialIndex + 1}. Move, click, or tap a trace to inspect a sample; use the controls below for keyboard access.`}
          onPointerDown={selectAtPointer}
          onPointerMove={(event) => {
            if (event.pointerType === 'mouse' || event.buttons > 0) selectAtPointer(event)
          }}
        >
          {channels.map((samples, channelIndex) => {
            const center = 18 + channelIndex * laneHeight + laneHeight / 2
            const path = samples
              .map((sample, sampleIndex) => {
                const x =
                  left +
                  ((timesSeconds[sampleIndex] - start) / (end - start)) * chartWidth
                const y = center - sample * 3.5
                return `${sampleIndex === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
              })
              .join(' ')

            return (
              <g key={channelNames[channelIndex]}>
                <line
                  className="signal-lane"
                  x1={left}
                  x2={width - right}
                  y1={center}
                  y2={center}
                />
                <text className="channel-label" x="0" y={center + 4}>
                  {channelNames[channelIndex]}
                </text>
                <path className="signal-trace" d={path} />
              </g>
            )
          })}
          {ticks.map((tick) => {
            const x = left + ((tick - start) / (end - start)) * chartWidth
            return (
              <g key={tick}>
                <line className="time-grid" x1={x} x2={x} y1="8" y2={chartHeight + 14} />
                <text className="time-label" x={x} y={chartHeight + 30} textAnchor="middle">
                  {tick.toFixed(1)} s
                </text>
              </g>
            )
          })}
          <line
            className={`playback-cursor${completed ? ' playback-cursor-complete' : ''}`}
            x1={cursorX}
            x2={cursorX}
            y1="8"
            y2={chartHeight + 13}
          />
          <circle className="selected-sample-ring" cx={selectedX} cy={selectedY} r="5" />
        </svg>
      </div>
      <div className="waveform-inspector">
        <label className="select-field channel-select">
          <span>
            Channel <Explanation topic="channel" />
          </span>
          <select
            aria-label="Waveform channel"
            value={selectedChannelIndex}
            onChange={(event) => setSelectedChannelIndex(Number(event.target.value))}
          >
            {channelNames.map((channelName, index) => (
              <option value={index} key={channelName}>{channelName}</option>
            ))}
          </select>
        </label>
        <label className="sample-range-field">
          <span>
            Displayed sample <Explanation topic="pointInspection" />
          </span>
          <input
            aria-label="Waveform sample point"
            type="range"
            min="0"
            max={timesSeconds.length - 1}
            value={selectedSampleIndex}
            onChange={(event) => setSelectedSampleIndex(Number(event.target.value))}
          />
          <span className="sample-range-ends">
            <span>{formatTime(timesSeconds[0])}</span>
            <span>{formatTime(timesSeconds[timesSeconds.length - 1])}</span>
          </span>
        </label>
        <output className="waveform-readout" aria-live="polite" aria-label="Selected waveform value">
          <strong>{channelNames[selectedChannelIndex]}</strong>
          <span>{formatTime(selectedTime)}</span>
          <b>{selectedValue.toFixed(4)} {modelInput.unit}</b>
        </output>
      </div>
      <p className="waveform-interpretation">
        This is the selected post-preprocessing sample in the downsampled display preview; a single point
        does not identify a thought or movement.
      </p>
    </>
  )
}

function ClassTag({ label }: { label: ClassName }) {
  return (
    <span className="class-tag" style={{ '--class-color': CLASS_COLORS[label] } as CSSProperties}>
      <span className="class-dot" aria-hidden="true" />
      {label.replace('_', ' ')}
    </span>
  )
}

function SummaryTable({ data }: { data: ReplayExport }) {
  const summary = useMemo(() => getReplaySummary(data.trials), [data.trials])

  return (
    <section className="panel summary-panel" aria-labelledby="summary-title">
      <div className="panel-heading summary-heading">
        <div>
          <p className="eyebrow">Run-level metrics</p>
          <h2 id="summary-title">
            Validation summary <Explanation topic="validation" />
          </h2>
        </div>
        <span className="validation-badge">VALIDATION ONLY</span>
      </div>
      <div className="summary-overview">
        <div className="accuracy-stat">
          <span className="stat-label explanation-label">
              Accuracy
              <Explanation
                topic="accuracy"
                body={`Accuracy is ${summary.correct} correct predictions divided by ${summary.total} imported validation trials (${(summary.accuracy * 100).toFixed(2)}%). This is the imported validation run, not independent final-test performance.`}
              />
          </span>
          <strong>{(summary.accuracy * 100).toFixed(1)}<small>%</small></strong>
          <span className="stat-subtitle">
            {summary.correct} correct of {summary.total} exported trials
          </span>
        </div>
        <div className="support-list" aria-label="True-label class support">
          {CLASS_ORDER.map((label) => (
            <div className="support-row" key={label}>
              <ClassTag label={label} />
              <span>{summary.support[label]} trials</span>
            </div>
          ))}
        </div>
      </div>
      <div className="matrix-wrap">
        <table className="confusion-matrix">
          <caption>
            Confusion matrix · validation trials <Explanation topic="confusionMatrix" />
          </caption>
          <thead>
            <tr>
              <th scope="col">True ↓ / Predicted →</th>
              {CLASS_ORDER.map((label) => (
                <th scope="col" key={label}>
                  <ClassTag label={label} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.confusionMatrix.map((row, rowIndex) => (
              <tr key={CLASS_ORDER[rowIndex]}>
                <th scope="row">
                  <ClassTag label={CLASS_ORDER[rowIndex]} />
                </th>
                {row.map((count, columnIndex) => (
                  <td
                    className={rowIndex === columnIndex ? 'matrix-correct' : ''}
                    key={CLASS_ORDER[columnIndex]}
                  >
                    <Explanation
                      title={`Actual ${CLASS_ORDER[rowIndex].replace('_', ' ')}, predicted ${CLASS_ORDER[columnIndex].replace('_', ' ')}`}
                      body={`${count} validation ${count === 1 ? 'trial' : 'trials'} in this cell had actual dataset label "${CLASS_ORDER[rowIndex].replace('_', ' ')}" and predicted label "${CLASS_ORDER[columnIndex].replace('_', ' ')}". ${rowIndex === columnIndex ? 'The labels match.' : 'The labels differ.'}`}
                      label={`Explain confusion matrix cell: actual ${CLASS_ORDER[rowIndex].replace('_', ' ')}, predicted ${CLASS_ORDER[columnIndex].replace('_', ' ')}, ${count} trials`}
                      triggerText={String(count)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TrialResult({ trial }: { trial: ReplayTrial }) {
  const winningScore = Math.max(...trial.scores.map((score) => Math.abs(score.logit)))
  return (
    <section className="panel result-panel" aria-labelledby="result-title" aria-live="polite">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Playback complete</p>
          <h2 id="result-title">Trial result</h2>
        </div>
        <span className={`outcome-pill ${trial.trueLabel === trial.predictedLabel ? 'is-correct' : 'is-error'}`}>
          <Explanation
            topic="correctness"
            title={trial.trueLabel === trial.predictedLabel ? 'Correct prediction' : 'Incorrect prediction'}
            body={`The predicted label "${trial.predictedLabel.replace('_', ' ')}" ${trial.trueLabel === trial.predictedLabel ? 'matches' : 'does not match'} the actual dataset label "${trial.trueLabel.replace('_', ' ')}".`}
            label={`Explain ${trial.trueLabel === trial.predictedLabel ? 'correct' : 'incorrect'} result`}
          />
          {trial.trueLabel === trial.predictedLabel ? 'Correct' : 'Incorrect'}
        </span>
      </div>
      <div className="result-labels">
        <div>
          <span className="stat-label explanation-label">
            Predicted class <Explanation topic="predictedClass" />
          </span>
          <ClassTag label={trial.predictedLabel} />
        </div>
        <div>
          <span className="stat-label explanation-label">
            Actual class <Explanation topic="actualClass" />
          </span>
          <ClassTag label={trial.trueLabel} />
        </div>
      </div>
      <div className="logit-heading">
        <span className="explanation-label">
          Model score (logit) <Explanation topic="logits" />
        </span>
        <span>Raw output · class order: fixed</span>
      </div>
      <div className="logit-list">
        {CLASS_ORDER.map((label, index) => {
          const score = trial.scores[index].logit
          const width = Math.max(1, (Math.abs(score) / winningScore) * 50)
          return (
            <div className="logit-row" key={label}>
              <span className="explanation-label score-class">
                <ClassTag label={label} />
                <Explanation
                  title={`${label.replace('_', ' ')} logit`}
                  body={`Raw model score for "${label.replace('_', ' ')}" in this trial: ${score.toFixed(3)}. The four logits are compared, and the largest selects the predicted class; this value is not a probability or confidence percentage.`}
                  label={`Explain ${label.replace('_', ' ')} score ${score.toFixed(3)}`}
                />
              </span>
              <div className="logit-track" aria-hidden="true">
                <span
                  className="logit-fill"
                  style={{
                    left: score < 0 ? `${50 - width}%` : '50%',
                    width: `${width}%`,
                    '--class-color': CLASS_COLORS[label],
                  } as CSSProperties}
                />
              </div>
              <output className="logit-value">{score.toFixed(3)}</output>
            </div>
          )
        })}
      </div>
      <p className="logit-note">Logits are uncalibrated model outputs, not confidence values.</p>
    </section>
  )
}

function Disclaimers() {
  return (
    <aside className="disclaimer-strip" aria-label="Research context">
      <p>Recorded EEG replay — not live acquisition.</p>
      <div className="explanation-label">
        <span>Predictions precomputed using the saved trained model.</span>
        <Explanation topic="precomputed" />
      </div>
      <div className="explanation-label">
        Motor-imagery classification — not thought-to-text.
        <Explanation topic="motorImagery" />
      </div>
      <p>Validation results — not independent final-test performance.</p>
    </aside>
  )
}

function HowToReadDemo() {
  return (
    <section className="panel how-to-panel" aria-labelledby="how-to-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Quick guide</p>
          <h2 id="how-to-title">How to read this demo</h2>
        </div>
        <Explanation topic="motorImagery" />
      </div>
      <ul className="how-to-statements">
        <li>This is recorded EEG replay, not live brain monitoring.</li>
        <li>The model classifies four motor-imagery labels.</li>
        <li>It does not decode words, sentences, or arbitrary thoughts.</li>
      </ul>
      <details className="learn-more">
        <summary>Learn more about the labels, model, and results</summary>
        <div>
          <p>
            The four task labels are feet, left hand, right hand, and tongue. Predicted is the saved
            model’s label; actual is the dataset’s task label. A match is correct for this task-label
            comparison, not proof of exactly what the participant thought.
          </p>
          <p>
            This replay shows precomputed predictions from validation data. The saved model is
            ShallowFBCSPNet, selected at epoch 20 using validation loss; an epoch is one pass through
            the training examples. Validation informed model development and is not an independent
            final test. <Explanation topic="model" />
          </p>
        </div>
      </details>
    </section>
  )
}

export default function Replay() {
  const [data, setData] = useState<ReplayExport | null>(null)
  const [loadError, setLoadError] = useState('')
  const [state, dispatch] = useReducer(playbackReducer, 0, createPlaybackState)

  const handleReplayImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    try {
      const contents = await readFileAsText(file)
      const importedData = parseReplayExport(JSON.parse(contents) as unknown)
      setData(importedData)
      setLoadError('')
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'The selected replay file is invalid.')
    } finally {
      input.value = ''
    }
  }

  useEffect(() => {
    if (data) {
      dispatch({ type: 'select', index: 0, startTime: getTrialBounds(data.trials[0]).startTime })
    }
  }, [data])

  const trial = data?.trials[state.selectedIndex]
  const bounds = trial ? getTrialBounds(trial) : null
  const endTime = trial?.waveformPreview.windowEndSeconds
  const completed = Boolean(bounds && state.currentTime >= bounds.endTime)

  useEffect(() => {
    if (!state.isPlaying || endTime === undefined) return
    const timer = window.setInterval(() => {
      dispatch({ type: 'tick', deltaSeconds: 0.05 * state.speed, endTime })
    }, 50)
    return () => window.clearInterval(timer)
  }, [endTime, state.isPlaying, state.speed])

  const handleSelectTrial = (index: number) => {
    const selected = data?.trials[index]
    if (!selected) return
    dispatch({ type: 'select', index, startTime: getTrialBounds(selected).startTime })
  }

  if (!data || !trial || !bounds) {
    return (
      <main className="replay-app">
        <div className="replay-shell">
          <header className="replay-header">
            <p className="eyebrow">Local analysis workspace</p>
            <h1>EEG Decoder Replay Studio</h1>
          </header>
          <Disclaimers />
          <section className="panel load-state" aria-live="polite">
            <span className={`status-indicator${loadError ? ' status-error' : ''}`} />
            <div>
              <h2>Import a local replay file</h2>
              <p>
                No EEG or prediction data are bundled. Select a compatible JSON export generated
                locally with this project’s exporter. The file is read in this browser and is not
                uploaded.
              </p>
              {loadError && <p className="import-error" role="alert">{loadError}</p>}
              <label className="local-file-label">
                Import local replay JSON
                <input
                  aria-label="Import local replay JSON"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleReplayImport}
                />
              </label>
            </div>
          </section>
          <HowToReadDemo />
        </div>
      </main>
    )
  }

  const elapsed = Math.max(0, state.currentTime - bounds.startTime)
  const duration = bounds.endTime - bounds.startTime
  const progress = (elapsed / duration) * 100

  return (
    <main className="replay-app">
      <div className="replay-shell">
        <header className="replay-header">
          <div className="title-block">
            <p className="eyebrow">Local analysis workspace <span className="header-divider">/</span> Recorded inference</p>
            <h1>EEG Decoder Replay Studio</h1>
            <p className="recording-context">
              BCI Competition IV-2a <span>·</span> BNCI2014_001 <span>·</span>
              <span className="context-help">
                Participant 1 <Explanation topic="participant" />
              </span>
              <span>·</span>
              <span className="context-help">
                Session 0train · Run 5 <Explanation topic="sessionRun" />
              </span>
            </p>
          </div>
          <div className="header-state">
            <span className="status-indicator" />
            <div>
              <strong>Static replay</strong>
              <span>{data.trials.length} imported validation trials</span>
            </div>
          </div>
        </header>

        <Disclaimers />

        <section className="panel playback-panel" aria-label="Trial playback controls">
          <div className="control-topline">
            <div>
              <p className="eyebrow">Recorded session</p>
              <h2>
                Playback controls <Explanation topic="playback" preferAbove />
              </h2>
            </div>
            <label className="select-field dataset-select">
              <span className="explanation-label">
                Recording <Explanation topic="recording" />
              </span>
              <select aria-label="Recording">
                <option value="bnci2014-001-p1-run5">
                  BNCI2014_001 · Participant 1 · Validation run 5
                </option>
              </select>
            </label>
            <label className="local-file-label compact-file-label">
              Import another local replay JSON
              <input
                aria-label="Import another local replay JSON"
                type="file"
                accept=".json,application/json"
                onChange={handleReplayImport}
              />
            </label>
          </div>
          {loadError && <p className="import-error" role="alert">{loadError}</p>}
          <div className="control-grid">
              <label className="select-field trial-select">
                <span className="explanation-label">
                  Trial <Explanation topic="trial" />
                </span>
              <select
                aria-label="Trial"
                value={state.selectedIndex}
                onChange={(event) => handleSelectTrial(Number(event.target.value))}
              >
                {data.trials.map((item, index) => (
                  <option value={index} key={item.trialIndex}>
                    Trial {String(item.trialIndex + 1).padStart(2, '0')} / {data.trials.length}
                  </option>
                ))}
              </select>
            </label>
            <div className="transport-controls" aria-label="Playback transport">
              <button
                className="icon-button"
                type="button"
                aria-label="Previous trial"
                disabled={state.selectedIndex === 0}
                onClick={() =>
                  dispatch({
                    type: 'previous',
                    startTime: getTrialBounds(data.trials[Math.max(0, state.selectedIndex - 1)]).startTime,
                  })
                }
              >
                <span aria-hidden="true">‹</span>
              </button>
              <button
                className="play-button"
                type="button"
                onClick={() => dispatch({ type: 'toggle', ...bounds })}
              >
                <span aria-hidden="true">{state.isPlaying ? 'Ⅱ' : '▶'}</span>
                {state.isPlaying ? 'Pause' : completed ? 'Replay' : 'Play'}
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="Next trial"
                disabled={state.selectedIndex === data.trials.length - 1}
                onClick={() => {
                  const nextIndex = Math.min(data.trials.length - 1, state.selectedIndex + 1)
                  dispatch({ type: 'next', startTime: getTrialBounds(data.trials[nextIndex]).startTime })
                }}
              >
                <span aria-hidden="true">›</span>
              </button>
              <button
                className="icon-button restart-button"
                type="button"
                aria-label="Restart trial"
                onClick={() => dispatch({ type: 'restart', startTime: bounds.startTime })}
              >
                <span aria-hidden="true">↺</span>
              </button>
            </div>
            <label className="select-field speed-select">
              <span className="explanation-label">
                Playback speed <Explanation topic="playbackSpeed" />
              </span>
              <select
                aria-label="Playback speed"
                value={state.speed}
                onChange={(event) => dispatch({ type: 'speed', speed: Number(event.target.value) })}
              >
                {PLAYBACK_SPEEDS.map((speed) => (
                  <option key={speed} value={speed}>{speed}×</option>
                ))}
              </select>
            </label>
          </div>
          <div
            className="progress-area"
            role="progressbar"
            aria-label="Trial playback progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="progress-readout">
              <span>{formatTime(state.currentTime)} <span className="readout-muted">/ {formatTime(bounds.endTime)}</span></span>
              <span>{Math.round(progress)}% <span className="readout-muted">played</span></span>
            </div>
          </div>
        </section>

        <section className="panel signal-panel" aria-labelledby="signal-title">
          <div className="panel-heading signal-heading">
            <div>
              <p className="eyebrow">Display-only waveform preview · 50 Hz</p>
              <h2 id="signal-title">
                EEG signals <Explanation topic="eegSignals" />
                <span className="trial-heading-note">Trial {trial.trialIndex + 1}</span>
              </h2>
            </div>
            <div className="signal-meta">
              <span>8 displayed channels</span>
              <span className="meta-divider" />
              <span>standardized units</span>
            </div>
          </div>
          <SignalViewer
            key={trial.trialIndex}
            trial={trial}
            currentTime={state.currentTime}
            completed={completed}
            modelInput={data.channelMetadata}
          />
          <div className="chart-footnote">
            <span className="explanation-label">
              Model input: 22 channels · 250 Hz · 1125 samples per trial
              <Explanation topic="modelInput" />
            </span>
            <span>Preview downsampling is display-only</span>
          </div>
        </section>

        <HowToReadDemo />

        {completed ? (
          <TrialResult trial={trial} />
        ) : (
          <section className="panel awaiting-panel" aria-live="polite">
            <span className="lock-glyph" aria-hidden="true">◷</span>
            <div>
              <p className="eyebrow">Results held until playback ends</p>
              <h2>Prediction and actual label are hidden</h2>
              <p>Play the recorded signal to the end to reveal this trial’s precomputed result and raw logits.</p>
            </div>
            <div className="awaiting-state">AWAITING END</div>
          </section>
        )}

        <SummaryTable data={data} />

        <footer className="replay-footer">
          <span>
            Run {data.run} · {data.trials.length} trials · Imported local replay data
          </span>
          <span>Data stays in this browser session</span>
        </footer>
      </div>
    </main>
  )
}
