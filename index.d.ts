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

import { HttpMethod, DataLike, Response } from '@augu/orchid';
import { Collection } from '@augu/collections';
import { EventBus } from '@augu/utils';
import { Agent } from 'undici';

/** Main entrypoint of @wumpcord/rest */
declare namespace Rest {
  /**
   * Represents a error related to Discord's API
   */
  export class DiscordAPIError extends Error {
    /**
     * Creates a new [DiscordAPIError] instance
     * @param code The code Discord gave us
     * @param message The actual message
     */
    constructor(code: number, message: string);
  }

  /** represents a validation error from the `_errors` property */
  interface ValidationError {
    message: string;
    code: string;
    key: string;
  }

  /**
   * Represents a REST error when we receive a non-200 status code.
   */
  export class DiscordRestError extends Error {
    /**
     * List of validation errors, if any
     */
    public errors: string[];

    /**
     * The response code Discord gave us
     */
    public code: number;

    /**
     * Represents a REST error when we receive a non-200 status code.
     * @param code The code Discord gave us
     * @param message The message Discord gave us
     * @param errors Any validation errors that may-of occured
     */
    constructor(code: number, message: string, errors?: any);
  }

  /**
   * Represents a token to cancel an asynchronous action
   */
  export interface CancellationToken<T> {
    /**
     * Resolves this [[CancellationToken]]
     */
    resolve(value: unknown): void;

    /**
     * The promise for this [[CancellationToken]]
     */
    promise: Promise<T>;
  }

  /**
   * Represents a list of cancellation tokens
   */
  export class CancellationTokens {
    /**
     * Checks if this bucket of tokens has remaning tokens left
     */
    public get remaining(): boolean;

    /**
     * Runs all the cancellation tokens and if there is none left,
     * resolves this method with nothing.
     */
    public run(): Promise<void>;

    /**
     * Runs the last token available to this context
     */
    public next(): void;
  }

  /**
    * Type alias for what image format Discord supports
    */
  export type ImageFormat =
    | 'png'
    | 'jpg'
    | 'webp'
    | 'gif';

  /**
    * Type alias of what image sizes Discord supports
    */
  export type ImageSize = 16 | 32 | 64 | 128 | 265 | 512 | 1024 | 2048 | 4096;

  export interface _CDN {
    /**
     * The base URL for pointing to the CDN
     */
    BaseUrl: string;

    getAchivementIcon: (appID: string, achivementID: string, icon: string) => string;
    getApplicationAsset:                    (appID: string, asset: string) => string;
    getApplicationIcon:                      (appID: string, icon: string) => string;
    getChannelIcon:                      (channelID: string, icon: string) => string;
    getCustomEmoji:                                      (emojiID: string) => string;
    getDefaultUserAvatar:   (discrim: string, format?: ImageFormat)        => string;
    getGuildBanner:                      (guildID: string, banner: string) => string;
    getGuildDiscoverySplash:             (guildID: string, splash: string) => string;
    getGuildIcon:                          (guildID: string, icon: string) => string;
    getGuildSplash:                      (guildID: string, splash: string) => string;
    getTeamIcon:                            (teamID: string, icon: string) => string;
    getUserAvatar(
      userID: string,
      avatar: string,
      format?: ImageFormat,
      size?: ImageSize
    ): string;
  }

  export const CDN: _CDN;

  export interface Constants {
    APIUrl(version?: number): string;

    /**
     * The supported rest versions
     */
    SupportedVersions: number[];

    /**
     * The current rest version (overrided)
     */
    RestVersion: 9;
  }

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

  /**
   * Represents a file to send on Discord
   */
  export interface MessageFile {
    /**
     * The name of the file
     * @default 'file.png'
     */
    name?: string;

    /**
     * The file contents to send
     */
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
    endpoint: string;
    method: HttpMethod;
    status: string;
    query?: Record<string, string>;
    body: string;
    ping: number;
  }

  /**
   * The rest client to create requests to Discord
   */
  export class RestClient<E extends RestClientEvents = RestClientEvents> extends EventBus<E> {
    /**
     * Millisecond timestamp when we received a request from Discord
     */
    public lastRequestedAt: number;

    /**
     * Milliseconds timestamp when we called [[RestClient.dispatch]]
     */
    public lastDispatchAt: number;

    /**
     * Represents the current cancellation token list
     */
    public clsToken: CancellationTokens;

    /**
     * List of routes for ratelimiting purposes
     */
    public routes: Collection<string, RouteBucket>;

    /**
     * List of options available
     */
    public options: Pick<RestClientOptions, 'baseUrl'> & { token: string | null; agent: Agent | null; };

    /**
     * The rest client to create requests to Discord
     * @param options Any additional options to create this RestClient
     */
    constructor(options: RestClientOptions);

    public get ping(): number;
    public dispatch<D extends DataLike | unknown = unknown, TReturn = unknown>(options: RequestDispatchOptions<D>): Promise<TReturn>;
  }

  /**
   * Represents a ratelimit buckets for specific routes
   */
  export class RouteBucket {
    /**
     * The global ratelimit promise
     */
    public static globalRatelimit: Promise<void> | null;

    /**
     * The route this [`RouteBucket`] belongs to
     */
    public readonly route: string;

    /**
     * The reset time for ratelimiting purposes
     */
    public resetTime: number;

    /**
     * The remaining times before we reach a 429 status
     */
    public remaining: number;

    /**
     * If this [`RouteBucket`] has been ratelimited or not
     */
    public get ratelimited(): boolean;

    /**
     * Returns the offset given by Discord's server date and our server date
     * @param serverDate The date in milliseconds Discord has gaven us
     */
    public getOffset(serverDate: string): number;

    /**
     * Handles the ratelimiting for this [`RouteBucket`]
     * @param res The orchid response
     */
    public handle(res: Response): Promise<void>;
  }
}

export = Rest;
export as namespace Rest;
