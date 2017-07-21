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