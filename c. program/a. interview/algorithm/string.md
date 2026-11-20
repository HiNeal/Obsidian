## 栈 - 用数组结构实现固定的栈

```swift
/* KMP算法
  * 子串和子数组:一定是连续
  * 子序列:可以连续,可以不连续
  * 基础概念:在一个字符串中,一个字符之前这个字符串的最长前缀和最长后缀的匹配长度,前缀不能包含最后一个字符,
  *         后缀不能包含第一个字符
  * abcabc
  * a c
  * ab bc
  * abc abc  相等 3就是指一个字符之前这个字符串的最长前缀 和 最长后缀的匹配长度
  * abca cabc
  * abcab bcabc
  * abcabc abcabc 不能取
  *
  * 配不上的那个字符最长前缀 和 最长后缀的匹配长度
  *
  * abkababkabF
  * abkababkabX
  *
  * abkababkabF
  *      abkababkabX
  *
  * abkababkabF
  *         abkababkabX
  *
  */
import Foundation

class Solution {
    // 获取字符串m在字符串s中的起始索引
    static func getIndexOf(_ s: String, _ m: String) -> Int {
        guard !s.isEmpty, !m.isEmpty, m.count <= s.count else {
            return -1
        }

        let str1 = Array(s)
        let str2 = Array(m)
        var i1 = 0
        var i2 = 0
        // 算出每个字符的最长匹配长度(0位置为-1,1位置为0)
        let next = getNextArray(str2)

        while i1 < str1.count && i2 < str2.count {
            if str1[i1] == str2[i2] {
                i1 += 1
                i2 += 1
            } else if next[i2] == -1 {
                i1 += 1
            } else {
                i2 = next[i2]
            }
        }

        return i2 == str2.count ? i1 - i2 : -1
    }

    // 计算next数组
    static func getNextArray(_ str: [Character]) -> [Int] {
        if str.count == 1 {
            return [-1]
        }

        var next = Array(repeating: 0, count: str.count)
        next[0] = -1
        next[1] = 0
        var pos = 2
        var cn = 0

        while pos < next.count {
            if str[pos - 1] == str[cn] {
                cn += 1
                next[pos] = cn
                pos += 1
            } else if cn > 0 {
                cn = next[cn]
            } else {
                next[pos] = 0
                pos += 1
            }
        }

        return next
    }

    static func main() {
        let str = "abcabcababaccc"
        let match = "ababa"
        print(getIndexOf(str, match))
    }
}

Solution.main()

```
