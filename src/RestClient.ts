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

import { HttpClient, HttpMethod } from '@augu/orchid';
import { Collection } from '@augu/collections';
import type { Agent } from 'undici';
import { EventBus } from '@augu/utils';
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
}

/**
 * Dispatch options for dispatching a request ([[RestClient.dispatch]])
 */
export interface RequestDispatch<D = unknown> {
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
  file?: Buffer;

  /**
   * The data supplied to create this request. GET requests
   * do not support supplying in data.
   */
  data?: D;
}

/**
 * Same as [[RequestDispatch]], but this interface has the promise created
 * from [[RestClient.dispatch]].
 */
export interface RequestDispatchPromise<D = unknown, TReturn = unknown> extends RequestDispatch<D> {
  /**
   * Resolves this request and returns the value of [[TReturn]].
   * @param value The value to supply when resolving the promise
   */
  resolve(value: TReturn | PromiseLike<TReturn>): void;

  /**
   * Rejects this request and returns a Error of what happened.
   * @param error The error supplied
   */
  reject(error?: Error): void;
}

const defaultOptions: RestClientOptions = {
  baseUrl: APIUrl
};

/**
 * The rest client to create requests to Discord
 */
export class RestClient {
  /**
   * Millisecond timestamp when we received a request from Discord
   */
  public lastRequestedAt: number = 0;

  /**
   * Milliseconds timestamp when we called [[RestClient.dispatch]]
   */
  public lastDispatchAt: number = 0;

  /**
   * List of ratelimits available per endpoint
   */
  public requests: Collection<string, RequestDispatchPromise[]>;

  /**
   * Options available to this [[RestClient]]
   */
  public options: Required<RestClientOptions>;
  #client: HttpClient;

  /**
   * The rest client to create requests to Discord
   * @param token The bot token to use
   * @param options The options to use
   */
  constructor(token: string, options: RestClientOptions = defaultOptions) {
    options = Object.assign(options, defaultOptions);

    this.requests = new Collection();
    this.options = options as Required<RestClientOptions>;
    this.#client = new HttpClient({
      defaults: {
        headers: {
          Authorization: token.replace('Bot ', '')
        }
      },
      baseUrl: options.baseUrl
    });
  }

  /**
   * Returns the ping for this [[RestClient]]. If no calls were
   * made, then it'll return `null` else the latency between
   * from the last request call minus the dispatch call.
   */
  get ping() {
    return this.lastRequestedAt === 0 && this.lastDispatchAt === 0
      ? null
      : (this.lastRequestedAt - this.lastDispatchAt);
  }

  dispatch<D = unknown, TReturn = unknown>(dispatch: RequestDispatch<D>) {
    return new Promise<TReturn>((resolve, reject) => {
      const dispatchee: RequestDispatchPromise<D> = {
        resolve,
        reject,
        ...dispatch
      };

      this.requests.emplace(dispatchee.endpoint, [dispatchee]);
      this.execute(dispatchee);
    });
  }

  protected execute<D, T>(dispatch: RequestDispatchPromise<D, T>) {
    // todo: this;
  }
}
