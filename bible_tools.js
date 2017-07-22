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

require("./bible_helpers");

/**
 * Returns the full regex for searching Bible references for specific language and Bible version
 * @param lang Language, for example 'en'
 * @param version Version, for example 'nkjv'
 */
var getBibleRegex = function(lang, version){
    var bibleBooks = "",
        literals = "",
        ret = {
            "ands": "；",
            "andenums": "，",
            "dashes": "\\-᠆‐‑‒–—―⁻₋−﹣－～",
            "bibleBooksRegex": "",
            "literals": {
                "and": [],
                "through": []
            }
        };

    try {
        var bibleBookInfo = require("./bibles/" + lang + "/" + version + "/info");
        for (var i = 0; i < bibleBookInfo.books.length; i++){

            bibleBooks += bibleBookInfo.books[i].name.bibleSynonymOptimization() + "|";

            for (var j = 0; j < bibleBookInfo.books[i].synonyms.length; j++){
                bibleBooks += bibleBookInfo.books[i].synonyms[j].bibleSynonymOptimization() + "|";
            }
        }
    } catch (err) {}

    try {
        var literalsInfo = require("./bibles/" + lang + "/literals");
        for (var i = 0; i < literalsInfo.and.length; i++) {
            ret.literals.and.push(literalsInfo.and[i]);
            literals += "( " + literalsInfo.and[i] + " )?";
        }
        for (var i = 0; i < literalsInfo.through.length; i++) {
            ret.literals.through.push(literalsInfo.through[i]);
            literals += "( " + literalsInfo.through[i] + " )?";
        }
    } catch (err) {}

    bibleBooks = bibleBooks.customTrim("| ");
    ret["bibleBooksRegex"] = "("+bibleBooks+")";
    ret["regex"] = "((" + bibleBooks + ")\\.?\\ ?([0-9\\.;,，：:\\ "+ret["dashes"] + ret["ands"]+"]" + literals + "(?!" + bibleBooks + "))+)";

    return ret;
};

/**
 * This function performs the actual fetch of the data in given language, version, book, chapter and verse.
 * Note that verse is optional parameter, since sometimes you want to fetch the whole chapter.
 * @param lang
 * @param version
 * @param book
 * @param chapter
 * @param verse
 * @returns {{book: string, chapter: string, verse: string, results: Array}}
 */
var fetch = function(lang, version, book, chapter, verse){
    var bibleInfo = require("./bibles/" + lang + "/" + version + "/info"),
        ret = {
            book: "",
            chapter: "",
            verse: "",
            results: []
        };

    for (var i = 0; i < bibleInfo.books.length; i++){
        var bookRegExp = bibleInfo.books[i].name.bibleSynonymOptimization() + "|";
        for (var j = 0; j < bibleInfo.books[i].synonyms.length; j++){
            bookRegExp += bibleInfo.books[i].synonyms[j].bibleSynonymOptimization() + "|";
        }
        bookRegExp = bookRegExp.customTrim("| ");
        if (book.match(new RegExp(bookRegExp, "ig"))){
            var bibleBook = require("./bibles/" + lang + "/" + version + "/books/" + (i+1).toString().lpad(2));

            chapter = chapter.toString().customTrim(" ");
            ret.book = bibleBook.name;
            ret.chapter = chapter;
            ret.verse = null;

            if (bibleBook.chapters.hasOwnProperty(chapter)){

                if (verse){
                    verse = verse.toString().customTrim(" ");
                    ret.verse = verse;
                    if (verse in bibleBook.chapters[chapter]){
                        ret.results.push(bibleBook.chapters[chapter][verse]);
                    }
                } else {
                    for (var key in bibleBook.chapters[chapter]) {
                        ret.results.push(bibleBook.chapters[chapter][key]);
                    }
                }
            }

            return ret;
        }
    }
};

/**
 * Performs the search of the passage
 * @param lang
 * @param version
 * @param term
 */
var search = function(lang, version, term) {
    var LITERAL_THROUGH = "-",
        LITERAL_RANGE = ":",
        LITERAL_AND = ";",
        LITERAL_AND_ENUM = ",";

    var result = { "term": term, results: []};

    try {
        var bibleRegex = getBibleRegex(lang, version),
            bibleBooksRegex = new RegExp(bibleRegex.bibleBooksRegex, "ig");

        term = term.replace(new RegExp("["+bibleRegex.dashes+"]", "ig"), LITERAL_THROUGH);
        term = term.replace(new RegExp("["+bibleRegex.ands+"]", "ig"), LITERAL_AND+" ");
        term = term.replace(new RegExp("["+bibleRegex.andenums+"]", "ig"), LITERAL_AND_ENUM+" ");
        term = term.replace(new RegExp("：", "ig"), LITERAL_RANGE).customTrim(" ;,");

        for (var i = 0; i < bibleRegex.literals.and.length; i++){
            term = term.replace(new RegExp(bibleRegex.literals.and[i], "g"), LITERAL_AND);
        }

        for (var i = 0; i < bibleRegex.literals.through.length; i++){
            term = term.replace(new RegExp(bibleRegex.literals.through[i], "ig"), LITERAL_THROUGH);
        }

        if (!term.match(bibleBooksRegex) || !term.match(bibleBooksRegex).length) return result;

        var book = term.match(bibleBooksRegex)[0];


        // tmp contains the part of search term without book name (ex 1:1)
        var tmp = term.replace(new RegExp(bibleRegex.bibleBooksRegex, "ig"), ""),
            blocks = tmp.split(LITERAL_AND);

        for (var i = 0; i < blocks.length; i++){
            var block = blocks[i],
                ranges = block.split(LITERAL_RANGE),
                chapter = ranges[0];

            result.results.push({});

            // This is explicitly to extract single chapter range of verses
            // ex. 1:3-5
            // TODO: support more complicated intra chapter references like 1:3-2:1
            if (ranges.length === 2){
                var verses = ranges[1].split(LITERAL_THROUGH);

                if (verses.length === 2){
                    var _result = {header:"", verses:""};

                    // Bible verse matching <book> <chapter>:<verse start>-<verse end> (ex. Gen. 1:1-2)
                    for (var j = parseInt(verses[0]); j <= parseInt(verses[1]); j++){
                        var _t = fetch(lang, version, book, chapter, j);
                        _result["header"] = "<h3>"+_t.book +" "+ block.customTrim(" ")+"</h3>";
                        _result["verses"] += _t.results.join("");
                    }

                    result.results[i]["header"] = _result["header"];
                    result.results[i]["verses"] = _result["verses"];
                } else {
                    // Bible verse matching <book> <chapter>:<verse> or <book> <chapter>:<verse>, <verse 2>, .. , <verse N>
                    // (ex. Gen. 1:1)
                    var versesEnum = verses[0].split(LITERAL_AND_ENUM);

                    result.results[i]["verses"] = "";

                    for (var j = 0; j < versesEnum.length; j++){
                        var _t = fetch(lang, version, book, chapter, parseInt(versesEnum[j]));
                        result.results[i]["header"] = "<h3>"+_t.book +" "+ chapter.customTrim(" ") + ":" + verses[0].customTrim(" ") +"</h3>";
                        result.results[i]["verses"] += _t.results.join("");
                    }
                }
            } else {
                var chapters = ranges[0].split(LITERAL_THROUGH);
                if (chapters.length === 2){
                    for (var j = parseInt(chapters[0].customTrim(" ")); j <= parseInt(chapters[1].customTrim(" ")); j++){
                        var _t = fetch(lang, version, book, j);
                        result.results[i]["header"] = "<h3>"+_t.book +" "+ block.customTrim(" ")+"</h3>";
                        result.results[i]["verses"] = _t.results.join("");
                    }
                } else if (chapters.length === 1) {
                    // Bible verse matching <book> <chapter> (ex. Gen. 1)
                    var _t = fetch(lang, version, book, chapter);
                    result.results[i]["header"] =  "<h3>"+_t.book +" "+ block.customTrim(" ")+"</h3>";
                    result.results[i]["verses"] = _t.results.join("");
                }
            }
        }

        return result;
    } catch (err) {
        console.log(err);
    }
};

// Bible Tools Module
var bibleTools = {
    // TODO:
    // listAvailableBibles()
    search: search,
    getBibleRegex: getBibleRegex
};

module.exports = bibleTools;