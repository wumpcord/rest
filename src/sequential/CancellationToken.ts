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

  /**
   * The state of this [[CancellationToken]].
   *
   * - `ongoing`: This cancellation token is ongoing it's execution process
   * - `resolved`: This cancellation token was resolved successfuly
   * - `cancelled`: This cancellation token was cancelled using the [[CancellationToken.cancel]] function.
   * - `just_init`: This cancellation token was just initialized from [[CancellationTokens.]]
   */
  state: 'ongoing' | 'resolved' | 'cancelled' | 'just_init';
}

/**
 * Represents a list of cancellation tokens
 */
export class CancellationTokens {
  // the tokens available
  protected _tokens: CancellationToken<void>[] = [];

  /**
   * Checks if this bucket of tokens has remaning tokens left
   */
  get remaining() {
    return this._tokens.length > 0;
  }

  /**
   * Runs all the cancellation tokens and if there is none left,
   * resolves this method with nothing.
   */
  run() {
    const next = this._tokens[this._tokens.length - 1] !== undefined
      ? this._tokens[this._tokens.length - 1].promise
      : Promise.resolve();

    this._createToken();
    return next;
  }

  /**
   * Runs the last token available to this context
   */
  next() {
    const token = this._tokens.shift();
    if (token !== undefined) {
      token.state = 'resolved';
      return token.resolve(null);
    }
  }

  // creates a token and returns it
  private _createToken() {
    let resolve!: ((value: any) => void);
    const promise = new Promise<void>((r) => (resolve = r));
    const token: CancellationToken<void> = {
      resolve,
      promise,
      state: 'just_init'
    };

    this._tokens.push(token);
    return token;
  }
}
