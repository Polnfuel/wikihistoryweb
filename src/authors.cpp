#include <string>
#include <vector>
#include <climits>
#include <cstdint>
#include <emscripten/bind.h>

using namespace std;

struct LCS {
    int Index1;
    int Index2;
    int Length;
};

std::vector<char32_t> utf8_to_u32(const std::string& str) {
    std::vector<char32_t> result;
    size_t i = 0;
    while (i < str.size()) {
        uint8_t c = static_cast<unsigned char>(str[i]);
        char32_t cp = 0;
        size_t len = 0;

        if ((c & 0b10000000) == 0) { // 1 byte
            cp = c;
            len = 1;
        } else if ((c & 0b11100000) == 0b11000000) { // 2 bytes
            cp = ((c & 0x1F) << 6) | (str[i + 1] & 0x3F);
            len = 2;
        } else if ((c & 0b11110000) == 0b11100000) { // 3 bytes
            cp = ((c & 0x0F) << 12) | ((str[i + 1] & 0x3F) << 6) | (str[i + 2] & 0x3F);
            len = 3;
        } else if ((c & 0b11111000) == 0b11110000) { // 4 bytes
            cp = ((c & 0x07) << 18) | ((str[i + 1] & 0x3F) << 12) |
                 ((str[i + 2] & 0x3F) << 6) | (str[i + 3] & 0x3F);
            len = 4;
        } else {
            // invalid, skip
            ++i;
            continue;
        }

        result.push_back(cp);
        i += len;
    }
    return result;
}

LCS LCSubstr(const std::string& s1_utf8, const std::string& s2_utf8) {
    std::vector<char32_t> s1 = utf8_to_u32(s1_utf8);
    std::vector<char32_t> s2 = utf8_to_u32(s2_utf8);

    int n = s1.size();
    int m = s2.size();

    std::vector<std::vector<int>> L(2, std::vector<int>(m));

    int z = 0;
    int foundIndex = INT32_MAX;
    int foundIndex2 = 0;

    for (int i = 0; i < n; i++) {
        int iCur = i % 2;
        for (int j = 0; j < m; j++) {
            bool first = i == 0 || j == 0 || L[1 - iCur][j - 1] == 0;

            if (s1[i] == s2[j] && (s1[i] == U' ' || !first)) {
                if (i == 0 || j == 0)
                    L[iCur][j] = 1;
                else
                    L[iCur][j] = L[1 - iCur][j - 1] + 1;

                if (s1[i] == U' ' && L[iCur][j] > z) {
                    z = L[iCur][j];
                    foundIndex = i;
                    foundIndex2 = j;
                }
            } else {
                L[iCur][j] = 0;
            }
        }
    }

    LCS lcs;
    lcs.Length = z;
    if (z == 0) {
        lcs.Index1 = -1;
        lcs.Index2 = -1;
    } else {
        lcs.Index1 = foundIndex - z + 1;
        lcs.Index2 = foundIndex2 - z + 1;
    }

    return lcs;
}

//em++ authors.cpp -O3 -s MODULARIZE=1 -s EXPORT_NAME="lcmodule" -s SINGLE_FILE=1 -o authors.mjs -std=c++20 --bind

EMSCRIPTEN_BINDINGS(analyzer) {
    emscripten::value_object<LCS>("LCS")
        .field("index1", &LCS::Index1)
        .field("index2", &LCS::Index2)
        .field("length", &LCS::Length);
    emscripten::function("LCSubstr", &LCSubstr);
}