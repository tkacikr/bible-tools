/*
 * Copyright (c) 2017 Adventech <info@adventech.io>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * String proto to add left padding with desired number of spaces filled with 0s
 * @param padding
 * @returns {string}
 */
String.prototype.lpad = function(padding) {
    var zeroes = new Array(padding+1).join("0");
    return (zeroes + this).slice(-padding);
};

/**
 * String proto to perform custom trim
 * @param charlist
 * @returns {string}
 */
String.prototype.customTrim = function(charlist) {
    var tmp = this.replace(new RegExp("^[" + charlist + "]+"), "");
    tmp = tmp.replace(new RegExp("[" + charlist + "]+$"), "")
    return tmp;
};

/**
 * Return optimized string for Regexp. Ex. replacing space with optional space
 * @returns {string}
 */
String.prototype.bibleSynonymOptimization = function(){
    return this.replace(/ /g, " ?") + "\\.?";
};

module.exports = this;