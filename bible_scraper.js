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

var async = require("async"),
    redis = require("redis"),
    cheerio = require("cheerio"),
    request = require("request"),
    fswf = require("safe-write-file"),
    helper = require("./bible_helpers");

var cursorBook = 0,
    cursorChapter = 0,
    bibleInfo = "";

var write = function(chapterRaw){
    var $ = cheerio.load(chapterRaw, {decodeEntities: false});
    var chapter = {};

    var prevVerse;

    $(".text").each(function(i, e){
        var verse = $(e).find(".versenum").text();
        if ($(e).find(".chapternum").length){
            verse = "1";
        }

        if (isNaN(parseInt(verse))){
            verse = prevVerse;
            chapter[parseInt(verse)] += $(e).html();
        } else {
            chapter[parseInt(verse)] = $(e).html();
        }

        prevVerse = verse;
    });

    try {
        var bookInfo = require("./" + bibleInfo.lang + "/" + bibleInfo.version + "/books/" + cursorBook.toString().lpad(2) + ".js");
        bookInfo.chapters[cursorChapter] = chapter;
        fswf("./" + bibleInfo.lang + "/" + bibleInfo.version + "/books/" + cursorBook.toString().lpad(2) + ".js", "var book = "+JSON.stringify(bookInfo, null, '\t')+";\nmodule.exports = book;");
    } catch (err){
        console.log(err)
    }
};

var scrapeBibleChapter = function(bookChapter, version, callback, scrapeOnly){
    var redis_client = redis.createClient();
    var url = "http://mobile.legacy.biblegateway.com/passage/?search=" + encodeURIComponent(bookChapter) + "&version=" + version;
    console.log("Fetching ", url);

    redis_client.get(url, function(err, reply) {
        if (!reply){
            request(
                {
                    "url": url,
                    "headers" : {
                        "User-Agent": "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)"
                    }
                },
                function(err, response, body) {
                    if (err) {console.log(err);return;}

                    var output = "";
                    var $ = cheerio.load(body, {decodeEntities: false});

                    $(".publisher-info-bottom").remove();
                    $(".passage-display-version").remove();

                    $(".passage-wrap > .passage-content").find(".passage-display, p").each(function(i, e){
                        $(e).find(".footnote, .footnotes").remove();
                        $(e).removeAttr("class");
                        $(e).removeAttr("id");
                        $(e).find("p, span, div, sup").removeAttr("id");
                        output += $("<div></div>").html($(e).clone()).html();
                        output = output.replace("h1>", "h3>");
                    });

                    redis_client.set(url, output);
                    redis_client.quit();

                    if (!scrapeOnly){
                        write(output);
                    }
                    setTimeout(function(){callback(null, 'test')}, 400);

                }
            );
        } else {
            redis_client.quit();
            if (!scrapeOnly){
                write(reply);
            }
            callback(null, 'test');
        }
    });
};

var scrapeBible = function(lang, version){
    var tasks = [];
    try {
        bibleInfo = require("./" + lang + "/" + version + "/info.js");

        for (var i = 1; i <= bibleInfo.books.length; i++){
            cursorBook = i;
            var bookInfo = {
                name: bibleInfo.books[i-1].name,
                numChapters: bibleInfo.books[i-1].numChapters,
                chapters: {}
            };
            fswf("./" + lang + "/" + version + "/books/" + cursorBook.toString().lpad(2) + ".js", "var book = "+JSON.stringify(bookInfo, null, '\t')+";\nmodule.exports = book;");

            for (var j = 1; j <= bibleInfo.books[i-1].numChapters; j++){
                cursorChapter = j;
                var bookName = bibleInfo.books[i-1].name + " " + cursorChapter;

                tasks.push((function(bookName,j,i){
                    return function(callback){
                        cursorBook = i;
                        cursorChapter = j;
                        scrapeBibleChapter(bookName, version, callback, false);
                    }
                })(bookName,j,i));
            }
        }
    } catch (err){
        console.log(err)
    }
    async.series(tasks);
};

/**
 * Scrapes Bible info and writes it as an info file
 * @param lang
 * @param version
 * @param name
 */
var scrapeBibleInfo = function(lang, version, name){
    var url = "https://www.biblegateway.com/versions/"+name;
    request(
        {
            "url": url,
            "headers" : {
                "User-Agent": "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)"
            }
        },
        function(err, response, body) {
            if (err) {console.log(err);}

            var $ = cheerio.load(body);

            var info = {
                lang: lang,
                version: version,
                books: []
            };

            $(".infotable tr").each(function(i, e){
                var numChapters = $(e).find(".num-chapters").text();
                $(e).find(".num-chapters").remove();
                var bookName = $(e).find(".book-name").text();
                info.books.push({"name": bookName, "numChapters": parseInt(numChapters), "synonyms": [bookName]});
            });

            fswf("./" + lang + "/" + version + "/info.js", "var info = " + JSON.stringify(info, null, '\t') + ";\nmodule.exports = info;");
        }
    );
};

// scrapeBibleInfo("en", "nasb", "New-American-Standard-Bible-NASB");
// scrapeBibleInfo("pt", "arc", "Almeida-Revista-e-Corrigida-2009-ARC");
// scrapeBibleInfo("uk", "ukr", "Ukrainian-Bible-UKR");
// scrapeBibleInfo("fr", "lsg", "Louis-Segond-LSG");
// scrapeBibleInfo("bg", "bg1940", "1940-Bulgarian-Bible-BG1940");
// scrapeBibleInfo("es", "rvr1960", "Reina-Valera-1960-RVR1960-Biblia");
// scrapeBibleInfo("ja", "jlb", "Japanese-Living-Bible-JLB");
// scrapeBibleInfo("ro", "rmnn", "Cornilescu-1924-RMNN-Bible");
// scrapeBibleInfo("pt", "nvi-pt", encodeURIComponent("Nova-Versão-Internacional-NVI-PT-Bíblia"))
// scrapeBibleInfo("de", "luth1545", "Luther-Bibel-1545-LUTH1545")

// scrapeBible("en", "nasb");
// scrapeBible("ja", "jlb");
// scrapeBible("pt", "arc");
// scrapeBible("fr", "lsg");
// scrapeBible("bg", "bg1940");
// scrapeBible("es", "rvr1960");
// scrapeBible("ro", "rmnn");
// scrapeBible("uk", "ukr");

// scrapeBible("pt", "nvi-pt");
// scrapeBible("de", "luth1545");