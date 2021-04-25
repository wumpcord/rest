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
  constructor(code: number, message: string, errors?: any) {
    super();

    this.errors = errors ? errors.map((error: ValidationError) => `[${error.code}: ${error.key}] ${error.message}`) : [];
    this.code = code;
    this.name = `DiscordRESTError [${code}]`;

    if (this.errors.length > 0) {
      this.message = `${message}\n  ${this.errors.join('\n  ')}`;
    } else {
      this.message = message;
    }
  }
}
