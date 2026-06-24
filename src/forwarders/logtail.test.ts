import fetchMock from 'jest-fetch-mock';
import { Request } from 'node-fetch';
import { either as E } from 'fp-ts';
import { logtailLogForwarder, parseMessageWithPowertoolsLogFormat } from '~/forwarders/logtail';
import { FunctionLogEvent } from '~/aws/events';

type PostedLog = { level?: string; message?: string };

const parsePostedBody = (callIndex = 0): PostedLog[] => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const body = fetchMock.mock.calls[callIndex]?.[1]?.body as string;
  return JSON.parse(body) as PostedLog[];
};

describe('test logtail log forwarding', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  const ingestionUrl = 'https://in.logtail.com/';
  const token = 'd4ed7843';

  const log: FunctionLogEvent = {
    type: 'function',
    time: new Date('2022-10-12T00:03:50.000Z'),
    record: '[INFO] Hello world, I am a function!',
  };

  test('forwarder should empty logs queue on successful POST with level detection enabled', async () => {
    fetchMock.mockIf((request: Request) => request.url === ingestionUrl, JSON.stringify({ message: 'ok' }), {
      status: 200,
    });

    const listener: { logsQueue: FunctionLogEvent[] } = {
      logsQueue: [log, log, log],
    };

    const result = await logtailLogForwarder(token, ingestionUrl, listener, true)();

    expect(E.left(result)).toBeTruthy();

    expect(fetchMock.mock.calls.length).toBe(1);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(ingestionUrl);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(fetchMock.mock.calls[0]?.[1]?.body).toEqual(
      JSON.stringify([
        { dt: new Date('2022-10-12T00:03:50.000Z'), message: '[INFO] Hello world, I am a function!', level: 'info' },
        { dt: new Date('2022-10-12T00:03:50.000Z'), message: '[INFO] Hello world, I am a function!', level: 'info' },
        { dt: new Date('2022-10-12T00:03:50.000Z'), message: '[INFO] Hello world, I am a function!', level: 'info' },
      ]),
    );
    expect(listener.logsQueue.length).toBe(0);
  });

  test('forwarder should re-queue logs on failure', async () => {
    fetchMock.mockIf((request: Request) => request.url === ingestionUrl, JSON.stringify({ message: 'bad' }), {
      status: 500,
    });

    const listener: { logsQueue: FunctionLogEvent[] } = {
      logsQueue: [log, log, log],
    };

    const result = await logtailLogForwarder(token, ingestionUrl, listener, true)();

    expect(E.left(result)).toBeTruthy();

    expect(fetchMock.mock.calls.length).toBe(1);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(ingestionUrl);
    expect(
      // eslint-disable-next-line
      fetchMock.mock.calls[0]?.[1]?.body,
    ).toEqual(
      JSON.stringify([
        { dt: new Date('2022-10-12T00:03:50.000Z'), message: '[INFO] Hello world, I am a function!', level: 'info' },
        { dt: new Date('2022-10-12T00:03:50.000Z'), message: '[INFO] Hello world, I am a function!', level: 'info' },
        { dt: new Date('2022-10-12T00:03:50.000Z'), message: '[INFO] Hello world, I am a function!', level: 'info' },
      ]),
    );
    expect(listener.logsQueue.length).toBe(3);
  });

  test('forwarder should detect ERROR level in plain text logs', async () => {
    fetchMock.mockIf((request: Request) => request.url === ingestionUrl, JSON.stringify({ message: 'ok' }), {
      status: 200,
    });

    const errorLog: FunctionLogEvent = {
      type: 'function',
      time: new Date('2022-10-12T00:03:50.000Z'),
      record: '[ERROR] Model failed to build',
    };

    const listener: { logsQueue: FunctionLogEvent[] } = {
      logsQueue: [errorLog],
    };

    const result = await logtailLogForwarder(token, ingestionUrl, listener, true)();

    expect(E.left(result)).toBeTruthy();
    const body = parsePostedBody();
    expect(body[0]?.level).toBe('error');
    expect(listener.logsQueue.length).toBe(0);
  });

  test('forwarder should detect WARN level in plain text logs', async () => {
    fetchMock.mockIf((request: Request) => request.url === ingestionUrl, JSON.stringify({ message: 'ok' }), {
      status: 200,
    });

    const warnLog: FunctionLogEvent = {
      type: 'function',
      time: new Date('2022-10-12T00:03:50.000Z'),
      record: '[WARN] Missing configuration',
    };

    const listener: { logsQueue: FunctionLogEvent[] } = {
      logsQueue: [warnLog],
    };

    const result = await logtailLogForwarder(token, ingestionUrl, listener, true)();

    expect(E.left(result)).toBeTruthy();
    const body = parsePostedBody();
    expect(body[0]?.level).toBe('warn');
    expect(listener.logsQueue.length).toBe(0);
  });

  test('forwarder should detect WARNING level in dbt-style plain text logs', async () => {
    fetchMock.mockIf((request: Request) => request.url === ingestionUrl, JSON.stringify({ message: 'ok' }), {
      status: 200,
    });

    const warnLog: FunctionLogEvent = {
      type: 'function',
      time: new Date('2022-10-12T00:03:50.000Z'),
      record: '1 of 5 WARNING table missing',
    };

    const listener: { logsQueue: FunctionLogEvent[] } = {
      logsQueue: [warnLog],
    };

    const result = await logtailLogForwarder(token, ingestionUrl, listener, true)();

    expect(E.left(result)).toBeTruthy();
    const body = parsePostedBody();
    expect(body[0]?.level).toBe('warn');
    expect(listener.logsQueue.length).toBe(0);
  });

  test('forwarder should strip ANSI codes when level detection is enabled', async () => {
    fetchMock.mockIf((request: Request) => request.url === ingestionUrl, JSON.stringify({ message: 'ok' }), {
      status: 200,
    });

    const ansiLog: FunctionLogEvent = {
      type: 'function',
      time: new Date('2022-10-12T00:03:50.000Z'),
      record: '\x1B[31mERROR\x1B[0m creating sql view model',
    };

    const listener: { logsQueue: FunctionLogEvent[] } = {
      logsQueue: [ansiLog],
    };

    const result = await logtailLogForwarder(token, ingestionUrl, listener, true)();

    expect(E.left(result)).toBeTruthy();
    const body = parsePostedBody();
    expect(body[0]?.level).toBe('error');
    expect(body[0]?.message).toBe('ERROR creating sql view model');
    expect(listener.logsQueue.length).toBe(0);
  });

  test('forwarder should not modify logs when level detection is disabled', async () => {
    fetchMock.mockIf((request: Request) => request.url === ingestionUrl, JSON.stringify({ message: 'ok' }), {
      status: 200,
    });

    const errorLog: FunctionLogEvent = {
      type: 'function',
      time: new Date('2022-10-12T00:03:50.000Z'),
      record: '[ERROR] Model failed',
    };

    const listener: { logsQueue: FunctionLogEvent[] } = {
      logsQueue: [errorLog],
    };

    const result = await logtailLogForwarder(token, ingestionUrl, listener, false)();

    expect(E.left(result)).toBeTruthy();
    const body = parsePostedBody();
    expect(body[0]?.level).toBeUndefined();
    expect(body[0]?.message).toBe('[ERROR] Model failed');
    expect(listener.logsQueue.length).toBe(0);
  });

  test('forwarder should treat dbt summary lines as info', async () => {
    fetchMock.mockIf((request: Request) => request.url === ingestionUrl, JSON.stringify({ message: 'ok' }), {
      status: 200,
    });

    const summaryLog: FunctionLogEvent = {
      type: 'function',
      time: new Date('2022-10-12T00:03:50.000Z'),
      record: 'Done. PASS=3 WARN=0 ERROR=16',
    };

    const listener: { logsQueue: FunctionLogEvent[] } = {
      logsQueue: [summaryLog],
    };

    const result = await logtailLogForwarder(token, ingestionUrl, listener, true)();

    expect(E.left(result)).toBeTruthy();
    const body = parsePostedBody();
    expect(body[0]?.level).toBe('info');
    expect(listener.logsQueue.length).toBe(0);
  });
});

describe('test parseMessageWithPowertoolsLogFormat`', () => {
  test('should succeed and return parsed result', () => {
    const log = JSON.stringify({
      level: 'INFO',
      message: 'An event occurred',
      service: 'mylambda-dev-doathing',
      timestamp: '2023-01-18T01:28:02.072Z',
      someProperty: 'hello',
      anotherProperty: ['test'],
    });

    const result = parseMessageWithPowertoolsLogFormat(log);

    expect(result).toStrictEqual({
      _tag: 'Right',
      right: {
        level: 'INFO',
        message: 'An event occurred',
        service: 'mylambda-dev-doathing',
        timestamp: '2023-01-18T01:28:02.072Z',
        someProperty: 'hello',
        anotherProperty: ['test'],
      },
    });
  });

  test('should fail when message is not valid', () => {
    const log = JSON.stringify({
      message: 'An event occurred',
      date: '2023-01-18T01:28:02.072Z',
    });
    const result = parseMessageWithPowertoolsLogFormat(log);

    expect(E.isLeft(result)).toStrictEqual(true);
  });
});
