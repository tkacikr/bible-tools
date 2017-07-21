#!/usr/bin/env node
var argv = require("optimist")
    .usage("Parse .md files for bible verses.\n" +
        "Usage: $0 -p [string] -l [string]")
    .alias({"p": "path"})
    .describe({
        "p": "Path to scan for .md files and parse. Not recursive",
        "l": "Parse language"
    })
    .demand(["p"])
    .default({ "l" : "en" })
    .argv;

var config = {
  "en": [
      "nkjv",
      "kjv"
  ],

  "ja": [
      "jlb"
  ]
};

var fs            = require("fs"),
    metaMarked    = require("meta-marked"),
    fswf          = require("safe-write-file"),
    yamljs        = require("yamljs");

require("./bible_helpers");

var SOURCE_EXTENSION = "md";

/**
 * Returns the full regex for searching Bible references for specific language and Bible version
 * @param lang Language, for example 'en'
 * @param version Version, for example 'nkjv'
 */
var getBibleRegex = function(lang, version){
    var bibleBooks = "",
        literals = "",
        ret = {
            "dashes": "\\-᠆‐‑‒–—―⁻₋−﹣－～",
            "bibleBooksRegex": "",
            "literals": {
                "and": [],
                "through": []
            }
        };

    try {
        var bibleBookInfo = require("./" + lang + "/" + version + "/info");
        for (var i = 0; i < bibleBookInfo.books.length; i++){

            bibleBooks += bibleBookInfo.books[i].name.bibleSynonymOptimization() + "|";

            for (var j = 0; j < bibleBookInfo.books[i].synonyms.length; j++){
                bibleBooks += bibleBookInfo.books[i].synonyms[j].bibleSynonymOptimization() + "|";
            }
        }
    } catch (err) {}

    try {
        var literalsInfo = require("./" + lang + "/literals");
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
    ret["regex"] = "((" + bibleBooks + ")\\.?\\ ([0-9\\.;,：:\\ "+ret["dashes"]+"]" + literals + "(?!" + bibleBooks + "))+)";

    return ret;
};

var fetch = function(lang, version, book, chapter, verse){
    var bibleInfo = require("./" + lang + "/" + version + "/info"),
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
            var bibleBook = require("./" + lang + "/" + version + "/books/" + (i+1).toString().lpad(2));

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
 *
 * @param lang
 * @param version
 * @param term
 */
var search = function(lang, version, term) {
    var LITERAL_THROUGH = "-",
        LITERAL_RANGE = ":",
        LITERAL_AND = ";",
        LITERAL_AND_ENUM = ",";

    var result = "";

    try {
        var bibleRegex = getBibleRegex(lang, version),
            bibleBooksRegex = new RegExp(bibleRegex.bibleBooksRegex, "ig");

        term = term.replace(new RegExp(bibleRegex.dashes, "ig"), LITERAL_THROUGH).customTrim(" ;,");
        term = term.replace(new RegExp("：", "ig"), LITERAL_RANGE).customTrim(" ;,");

        for (var i = 0; i < bibleRegex.literals.and.length; i++){
            term = term.replace(new RegExp(bibleRegex.literals.and[i], "ig"), LITERAL_AND);
        }

        for (var i = 0; i < bibleRegex.literals.through.length; i++){
            term = term.replace(new RegExp(bibleRegex.literals.through[i], "ig"), LITERAL_THROUGH);
        }

        var book = term.match(bibleBooksRegex)[0];


        // tmp contains the part of search term without book name (ex 1:1)
        var tmp = term.replace(new RegExp(bibleRegex.bibleBooksRegex, "ig"), ""),
            blocks = tmp.split(LITERAL_AND);

        for (var i = 0; i < blocks.length; i++){
            var block = blocks[i],
                ranges = block.split(LITERAL_RANGE),
                chapter = ranges[0];

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

                    result += _result["header"] + _result["verses"];
                } else {
                    // Bible verse matching <book> <chapter>:<verse> or <book> <chapter>:<verse>, <verse 2>, .. , <verse N>
                    // (ex. Gen. 1:1)
                    var versesEnum = verses[0].split(LITERAL_AND_ENUM);

                    for (var j = 0; j < versesEnum.length; j++){
                        var _t = fetch(lang, version, book, chapter, parseInt(versesEnum[j]));
                        result += "<h3>"+_t.book +" "+ chapter.customTrim(" ") + ":" + versesEnum[j].customTrim(" ") +"</h3>";
                        result += _t.results.join("");
                    }
                }
            } else {
                // Bible verse matching <book> <chapter> (ex. Gen. 1)
                var _t = fetch(lang, version, book, chapter);
                result += "<h3>"+_t.book +" "+ block.customTrim(" ")+"</h3>";
                result += _t.results.join("");
            }
        }

        return result;
    } catch (err) {
        console.log(err);
    }
};

/**
 *
 * @param path
 */
var processParsing = function(path){
    var mds = fs.readdirSync(path);

    for (var i = 0; i < mds.length; i++) {
        var extension = mds[i].split(".").pop();
        if (extension !== SOURCE_EXTENSION) continue;

        var read = metaMarked(fs.readFileSync(path + mds[i], "utf-8")),
            meta = read.meta;

        meta.bible = [];

        for (var bibleVersionIterator = 0; bibleVersionIterator < config[argv.l].length; bibleVersionIterator++){
            var lang = argv.l,
                bibleVersion = config[lang][bibleVersionIterator],
                bibleRegex = this.getBibleRegex(lang, bibleVersion),
                bibleReferenceMatches = read.markdown.match(new RegExp(bibleRegex.regex, "ig")),
                resultRead = read.markdown,
                resultBible = {};

            resultBible["name"] = bibleVersion.toUpperCase();
            resultBible["verses"] = {};

            if (!bibleReferenceMatches) { continue; }

            bibleReferenceMatches = bibleReferenceMatches.sort(function(a,b){
                return b.length - a.length;
            });

            for (var j = 0; j < bibleReferenceMatches.length; j++){
                var verse = bibleReferenceMatches[j];
                resultBible["verses"][verse] = bibleSearch.search(lang, bibleVersion, verse);
                resultRead = resultRead.replace(new RegExp('(?!<a[^>]*?>)('+bibleReferenceMatches[j]+')(?![^<]*?</a>)', "g"), '<a class="verse" verse="'+bibleReferenceMatches[j]+'">'+bibleReferenceMatches[j]+'</a>');
            }

            meta.bible.push(resultBible);
        }
        fswf(path + "/" + mds[i] + ".biblez", "---\n" + yamljs.stringify(meta, 4) + "\n---" + resultRead);
    }
};

// Bible Search Module
var bibleSearch = {
    search: search,
    getBibleRegex: getBibleRegex,
    processParsing: processParsing
};

// module.exports = bibleSearch;

bibleSearch.processParsing(argv.p);

// console.log(bibleSearch.getBibleRegex("en", "nkjv"));
// console.log(bibleSearch.search("ja", "jlb", "使徒言行録6：9～15"));
