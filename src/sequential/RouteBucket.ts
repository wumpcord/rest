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

import type { Response } from '@augu/orchid';
import { sleep } from '@augu/utils';

/**
 * Represents a ratelimit buckets for specific routes
 */
export class RouteBucket {
  /**
   * The global ratelimit promise
   */
  public static globalRatelimit: Promise<void> | null = null;

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
   * Represents a ratelimit buckets for specific routes
   * @param route The route this [`RouteBucket`] belongs to
   */
  constructor(route: string) {
    this.resetTime = -1;
    this.remaining = -1;
    this.route = route;
  }

  /**
   * If this [`RouteBucket`] has been ratelimited or not
   */
  get ratelimited() {
    return this.remaining === 0 && this.resetTime > Date.now();
  }

  /**
   * Returns the offset given by Discord's server date and our server date
   * @param serverDate The date in milliseconds Discord has gaven us
   */
  getOffset(serverDate: string) {
    return new Date(serverDate).getTime() - Date.now();
  }

  /**
   * Handles the ratelimiting for this [`RouteBucket`]
   * @param res The orchid response
   */
  async handle(res: Response) {
    const serverDate = res.headers['date'] as string;
    const remaining = res.headers['x-ratelimit-remaining'] as string;
    const resetAfter = Math.round(Number(res.headers['x-ratelimit-reset']));
    let retryAfter = +res.headers['retry-after'];
    const via = res.headers['via'];

    if (retryAfter !== undefined && (typeof via !== 'string' || via.includes('1.1 google')))
      retryAfter *= 1000;

    this.remaining = remaining !== undefined ? Number(remaining) : 1;
    this.resetTime = resetAfter !== undefined
      ? this.route.includes('reactions')
        ? new Date(serverDate).getTime() - this.getOffset(serverDate) + 250 // https://github.com/discord/discord-api-docs/issues/182
        : new Date(+resetAfter * 1000).getTime() - this.getOffset(serverDate)
      : Date.now();

    if (isNaN(this.resetTime))
      this.resetTime = Date.now();

    if (res.headers['x-ratelimit-global']) {
      RouteBucket.globalRatelimit = sleep(retryAfter).then(() => {
        RouteBucket.globalRatelimit = null;
      });

      await RouteBucket.globalRatelimit;
    }
  }
}
