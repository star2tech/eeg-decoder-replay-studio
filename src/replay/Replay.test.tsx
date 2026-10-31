// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Replay from './Replay'
import { createSyntheticReplayFixture } from './Replay.testFixture'
import {
  CLASS_ORDER,
  createPlaybackState,
  getReplaySummary,
  parseReplayExport,
  playbackReducer,
} from './replayData'

const syntheticExport = createSyntheticReplayFixture()
const parsedSyntheticExport = parseReplayExport(syntheticExport)

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function renderWithImportedSyntheticReplay() {
  render(<Replay />)
  const fileInput = screen.getByLabelText('Import local replay JSON')
  const file = new File(
    [JSON.stringify(syntheticExport)],
    'synthetic-interface-test.json',
    { type: 'application/json' },
  )
  fireEvent.change(fileInput, { target: { files: [file] } })
  await screen.findByRole('combobox', { name: 'Trial' })
}

describe('EEG replay data and playback', () => {
  it('explains that no recorded data is bundled and provides a local import control', () => {
    render(<Replay />)

    expect(screen.getByText(/No EEG or prediction data are bundled/)).toBeInTheDocument()
    expect(screen.getByLabelText('Import local replay JSON')).toHaveAttribute('type', 'file')
    expect(screen.getByText('The model classifies four motor-imagery labels.')).toBeInTheDocument()
  })

  it('reports an invalid local file without substituting data', async () => {
    render(<Replay />)
    const invalidFile = new File(['not json'], 'invalid.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Import local replay JSON'), {
      target: { files: [invalidFile] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(/JSON|Unexpected token/i)
    expect(screen.queryByRole('combobox', { name: 'Trial' })).not.toBeInTheDocument()
  })

  it('opens explanations on focus and click and dismisses them with Escape', async () => {
    await renderWithImportedSyntheticReplay()

    const explanationToggle = screen.getByLabelText('Explain EEG signals')
    expect(explanationToggle).toHaveAttribute('aria-controls')
    fireEvent.focus(explanationToggle)

    expect(explanationToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'EEG signals' }))
      .toHaveTextContent(/recorded EEG after preprocessing and exponential moving standardization/)
    expect(screen.getByLabelText('Explain Model input')).toBeInTheDocument()
    expect(screen.getByLabelText('Explain Validation scope')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(explanationToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog', { name: 'EEG signals' })).not.toBeInTheDocument()

    fireEvent.click(explanationToggle)
    expect(explanationToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'EEG signals' })).toBeInTheDocument()
  })

  it('inspects actual selected test-fixture waveform values in standardized units', async () => {
    await renderWithImportedSyntheticReplay()

    fireEvent.change(screen.getByLabelText('Waveform channel'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Waveform sample point'), { target: { value: '24' } })

    const channelName = parsedSyntheticExport.trials[0].waveformPreview.channelNames[2]
    const sampleTime = parsedSyntheticExport.trials[0].waveformPreview.timesSeconds[24]
    const sampleValue = parsedSyntheticExport.trials[0].waveformPreview.channels[2][24]
    const readout = screen.getByLabelText('Selected waveform value')
    expect(readout).toHaveTextContent(channelName)
    const formattedTime = `${sampleTime < 0 ? '−' : ''}${Math.abs(sampleTime).toFixed(2)} s`
    expect(readout).toHaveTextContent(formattedTime)
    expect(readout).toHaveTextContent(`${sampleValue.toFixed(4)} standardized units`)
    expect(screen.getByText(/a single point does not identify a thought or movement/)).toBeInTheDocument()
  })

  it('explains confusion-matrix cells with actual class, predicted class, and count', async () => {
    await renderWithImportedSyntheticReplay()

    const cell = screen.getByLabelText(
      'Explain confusion matrix cell: actual left hand, predicted right hand, 1 trials',
    )
    fireEvent.focus(cell)

    expect(screen.getByRole('dialog', { name: 'Actual left hand, predicted right hand' }))
      .toHaveTextContent('1 validation trial')
    expect(screen.getByRole('dialog', { name: 'Actual left hand, predicted right hand' }))
      .toHaveTextContent('actual dataset label "left hand" and predicted label "right hand"')
  })

  it('labels recorded playback and precomputed prediction disclaimers explicitly', async () => {
    await renderWithImportedSyntheticReplay()

    expect(screen.getByText('Recorded EEG replay — not live acquisition.')).toBeInTheDocument()
    expect(screen.getByText('Predictions precomputed using the saved trained model.'))
      .toBeInTheDocument()
    expect(screen.getByText('This is recorded EEG replay, not live brain monitoring.'))
      .toBeInTheDocument()
    expect(screen.getByText('The model classifies four motor-imagery labels.')).toBeInTheDocument()
    expect(screen.getByText('It does not decode words, sentences, or arbitrary thoughts.'))
      .toBeInTheDocument()
  })

  it('uses the verified score order and derives the fixture summary from its trial rows', () => {
    expect(CLASS_ORDER).toEqual(['feet', 'left_hand', 'right_hand', 'tongue'])
    expect(parsedSyntheticExport.trials[0].waveformPreview.windowEndSeconds).toBe(4)

    const summary = getReplaySummary(parsedSyntheticExport.trials)
    expect(summary).toMatchObject({
      total: 4,
      correct: 2,
      accuracy: 0.5,
      support: { feet: 1, left_hand: 1, right_hand: 1, tongue: 1 },
      confusionMatrix: [
        [1, 0, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [1, 0, 0, 0],
      ],
    })
    expect(parsedSyntheticExport.trials[0].scores.map((score) => score.className)).toEqual(CLASS_ORDER)
  })

  it('resets and navigates to the selected trial start time', () => {
    const initial = createPlaybackState(-0.5)
    const atEnd = playbackReducer(initial, {
      type: 'tick',
      deltaSeconds: 4.5,
      endTime: 4,
    })
    const next = playbackReducer(atEnd, { type: 'next', startTime: -0.5 })
    const selected = playbackReducer(next, { type: 'select', index: 2, startTime: -0.5 })

    expect(atEnd).toMatchObject({ currentTime: 4, isPlaying: false })
    expect(next).toMatchObject({ selectedIndex: 1, currentTime: -0.5, isPlaying: false })
    expect(selected).toMatchObject({ selectedIndex: 2, currentTime: -0.5, isPlaying: false })
  })

  it('keeps prediction hidden during playback and reveals results only at trial end', async () => {
    await renderWithImportedSyntheticReplay()

    expect(await screen.findByRole('heading', { name: 'Prediction and actual label are hidden' }))
      .toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Playback speed' }), {
      target: { value: '2' },
    })
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    await act(async () => {
      vi.advanceTimersByTime(2300)
    })

    const resultHeading = screen.getByRole('heading', { name: 'Trial result' })
    const resultPanel = resultHeading.closest('section')
    expect(resultPanel).not.toBeNull()
    expect(within(resultPanel as HTMLElement).getAllByText('right hand')).toHaveLength(2)
    expect(within(resultPanel as HTMLElement).getAllByText('left hand')).toHaveLength(2)
    expect(within(resultPanel as HTMLElement).getByText('1.200')).toBeInTheDocument()
  })

  it('keeps imported trial choices and resets playback after selection', async () => {
    await renderWithImportedSyntheticReplay()
    const selector = screen.getByRole('combobox', { name: 'Trial' })

    expect(selector.querySelectorAll('option')).toHaveLength(4)
    fireEvent.change(selector, { target: { value: '1' } })

    expect(selector).toHaveValue('1')
    expect(screen.getByText('Trial 2', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Prediction and actual label are hidden' }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous trial' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next trial' }))
    expect(selector).toHaveValue('2')
    fireEvent.click(screen.getByRole('button', { name: 'Previous trial' }))
    expect(selector).toHaveValue('1')
    fireEvent.click(screen.getByRole('button', { name: 'Previous trial' }))
    expect(selector).toHaveValue('0')
  })
})
