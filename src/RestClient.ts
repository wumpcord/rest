/**
 * Copyright (c) 2021 August
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { DataLike, HttpClient, HttpMethod, middleware } from '@augu/orchid';
import { EventBus, sleep, isObject } from '@augu/utils';
import { CancellationTokens } from './sequential/CancellationToken';
import { DiscordRestError } from './errors/DiscordRestError';
import { DiscordAPIError } from './errors/DiscordAPIError';
import { STATUS_CODES } from 'http';
import type { Agent } from 'undici';
import { APIUrl } from './Constants';
import FormData from 'form-data';

/**
 * Rest client options to override
 */
export interface RestClientOptions {
  /**
   * The base URL
   */
  baseUrl?: string;

  /**
   * Specific undici agent to use, it'll default to orchid's agent if this isn't
   * set.
   */
  agent?: Agent;

  /**
   * The token to use for this [[RestClient]]
   */
  token?: string;
}

/**
 * Dispatch options for dispatching a request ([[RestClient.dispatch]])
 */
export interface RequestDispatchOptions<D = unknown> {
  /**
   * The reason to put under audit logs
   */
  auditLogReason?: string;

  /**
   * The endpoint to use when creating this request
   */
  endpoint: string;

  /**
   * The HTTP/1.1 method verb to use
   */
  method: HttpMethod;

  /**
   * The path parameters to use in the [[RequestDispatch<D>.endpoint]].
   */
  query?: Record<string, string>;

  /**
   * The file to send to Discord
   */
  file?: MessageFile;

  /**
   * If this requires authenication
   */
  auth?: boolean;

  /**
   * The data supplied to create this request. GET requests
   * do not support supplying in data.
   */
  data?: D;
}

export interface MessageFile {
  name?: string;
  file: Buffer;
}

export interface RestClientEvents {
  /**
   * Emitted when the rest client is ratelimited
   * @param props The properties from the request
   */
  ratelimited(): void;

  /**
   * Emitted when the rest client sends something debug worthy
   * @param message The message
   */
  debug(message: string): void;

  /**
   * Emitted when the rest client has successfully made a request
   * @param props The properties from the request
   */
  call(props: RestCallProperties): void;
}

/**
 * Represents a object of properties of this request
 */
export interface RestCallProperties {
  ratelimited: boolean;
  status: string;
  body: string;
  ping: number;
}

/**
 * The rest client to create requests to Discord
 */
export class RestClient<E extends RestClientEvents = RestClientEvents> extends EventBus<E> {
  protected _globalTimeout: Promise<any> | null = null;
  protected _retryAfter: number | null = null;

  /**
   * Millisecond timestamp when we received a request from Discord
   */
  public lastRequestedAt: number = 0;

  /**
   * Milliseconds timestamp when we called [[RestClient.dispatch]]
   */
  public lastDispatchAt: number = 0;

  /**
   * If the rest client has been ratelimited or not
   */
  public ratelimited: boolean = false;

  /**
   * How many requests we can make
   */
  public remaining: number = 0;

  /**
   * The reset time
   */
  public resetTime: number = -1;

  /**
   * The limit of requests
   */
  public limit: number = -1;

  /**
   * Represents the current cancellation token list
   */
  public clsToken: CancellationTokens = new CancellationTokens();

  /**
   * List of options available
   */
  public options: Pick<RestClientOptions, 'baseUrl'> & { token: string | null; agent: Agent | null; };
  #client: HttpClient;

  /**
   * The rest client to create requests to Discord
   * @param options Any additional options to create this RestClient
   */
  constructor(options: RestClientOptions) {
    super();

    this.options = {
      baseUrl: options.baseUrl ?? APIUrl,
      agent: options.agent ?? null,
      token: options.token ?? null
    };

    this.#client = new HttpClient({
      defaults: {
        headers: options.token !== undefined ? { Authorization: `Bot ${options.token}` } : {}
      },

      userAgent: 'DiscordBot (+https://github.com/auguwu/Wumpcord)'
    });
  }

  get ping() {
    return this.lastRequestedAt === -1 && this.lastDispatchAt === -1
      ? 0
      : (this.lastRequestedAt - this.lastDispatchAt);
  }

  async dispatch<D extends DataLike | unknown = unknown, TReturn = unknown>(options: RequestDispatchOptions<D>) {
    this._setupLogging();
    await this.clsToken.run();

    try {
      if (this._globalTimeout !== null) {
        await this._globalTimeout;
      }

      if (this.ratelimited) {
        // @ts-ignore why are u like this
        this.emit('ratelimited');
        await sleep(this._retryAfter!);
      }

      this.lastDispatchAt = Date.now();
      return this._execute<D, TReturn>(options);
    } finally {
      this.clsToken.next();
    }
  }

  private _setupLogging() {
    const listeners = super.size('debug');
    if (listeners > 0 && !this.#client.middleware.has('logging')) {
      this.#client.use(middleware.logging({
        useConsole: false,

        // @ts-ignore "Argument of type '[string]' is not assignable to parameter of type 'ListenerArgs<E["debug"]>'."
        log: (message) => this.emit('debug', `[HTTP] ${message}`)
      }));
    }
  }

  protected async _execute<D extends DataLike | unknown = unknown, TReturn = unknown>(options: RequestDispatchOptions<D>): Promise<TReturn | undefined> {
    const form = options.file !== undefined ? new FormData() : null;
    const headers: Record<string, any> = {
      Authorization: `Bot ${this.options.token}`
    };

    if (options.method !== 'GET' && options.method !== 'HEAD' && options.method !== 'get' && options.method !== 'head') {
      headers['content-type'] = form !== null ? form.getHeaders()['content-type'] : 'application/json';
    }

    if (options.auditLogReason !== undefined)
      headers['x-audit-log-reason'] = encodeURIComponent(options.auditLogReason);

    if (options.file !== undefined) {
      if (Array.isArray(options.file)) {
        for (let i = 0; i < options.file.length; i++) {
          const file = options.file[i];
          if (!file.name)
            file.name = 'file.png';

          form!.append(file.name, file.file, { filename: file.name });
        }
      } else {
        if (!options.file.name)
          options.file.name = 'file.png';

        form!.append(options.file.name, options.file.file, { filename: options.file.name });
      }

      if (options.data !== undefined)
        form!.append('payload_json', JSON.stringify(options.data));
    }

    const res = await this.#client.request({
      headers,
      method: options.method,
      query: options.query,
      data: (form !== null ? form : options.data) as any,
      url: `${this.options.baseUrl}${options.endpoint}`
    });

    if (res.statusCode === 204)
      return;

    this.lastRequestedAt = Date.now();
    const data = res.json();

    // @ts-ignore
    this.emit('debug', `[REST -> ${options.method.toUpperCase()} ${options.endpoint}] Received a ${res.statusCode} status code!`);

    const limit = res.headers['x-ratelimit-limit'] as string;
    const _remaining = res.headers['x-ratelimit-remaining'] as string;
    const resetAfter = res.headers['x-ratelimit-reset-after'] as string;
    let retryAfter = res.headers['x-ratelimit-retry'] as string | number;
    const via = res.headers['via'];

    this.resetTime = +resetAfter * 1000 + Date.now(); // TODO: add offset?
    this.remaining = _remaining !== undefined ? +_remaining : 1;
    this.limit = limit !== undefined ? +limit : Infinity;

    if (retryAfter !== undefined)
      retryAfter = resetAfter
        ? Number(retryAfter) + (via !== undefined ? 1000 : 1 + 0)
        : Date.now();

    if (res.headers['x-ratelimit-global'] !== undefined)
      this._globalTimeout = sleep(Number(retryAfter)).then(() => (this._globalTimeout = null));

    if (res.statusCode === 429) {
      // @ts-ignore
      this.emit('debug', `[REST -> ${options.method.toUpperCase()} ${options.endpoint}] Ratelimited.`);

      this.ratelimited = true;
      await sleep(Number(retryAfter));

      return this._execute(options);
    }

    if (res.statusCode >= 500)
      throw new DiscordAPIError(res.statusCode, STATUS_CODES[res.statusCode]!);

    if (data.hasOwnProperty('code') && data.hasOwnProperty('message')) {
      const errors = data.errors;
      throw new DiscordRestError(data.code as number, data.message as string, errors);
    }

    return data as TReturn;
  }
}
