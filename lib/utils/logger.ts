/**
 * Structured logging.
 *
 * One line of JSON per event, so Vercel's log search and any downstream drain can
 * filter on `event` rather than grepping prose. Every call names an event; free-text
 * messages are not loggable on their own, because a log you cannot query is a log
 * you will not read during an incident.
 *
 * Never log secrets, tokens, full email addresses, or request bodies.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

function emit(level: LogLevel, event: string, context?: LogContext): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context,
  })

  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (event: string, context?: LogContext) => {
    if (process.env.NODE_ENV !== 'production') emit('debug', event, context)
  },
  info: (event: string, context?: LogContext) => emit('info', event, context),
  warn: (event: string, context?: LogContext) => emit('warn', event, context),
  error: (event: string, context?: LogContext) => emit('error', event, context),
}

/**
 * Emits at a sampled rate, for events that are individually uninteresting but
 * collectively meaningful — a degraded dependency on a hot public path would
 * otherwise produce thousands of identical lines per minute and bury everything else.
 */
export function logSampled(
  level: LogLevel,
  event: string,
  sampleRate: number,
  context?: LogContext
): void {
  if (Math.random() < sampleRate) emit(level, event, { ...context, sampled: sampleRate })
}
