var expect = require("chai").expect,
    bibleTools = require('../bible_tools');

describe('Structure tests for verse only', function() {
    it('Should have property results', function() {
        expect(bibleTools.search("en", "nkjv", "Gen 1:1")).have.property("results");
    });

    it('Should have verse in the results', function() {
        expect(bibleTools.search("en", "nkjv", "Gen 1:1")).to.have.nested.property("results[0].verses");
    });

    it('Should have proper verse', function() {
        expect(bibleTools.search("en", "nkjv", "Gen 1:1")).to.have.nested.property("results[0].verses").to.have.string("In the beginning God created the heavens and the earth");
    });
});
