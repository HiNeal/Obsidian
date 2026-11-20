## 基础 - 斐波那契数列

```swift
import Foundation

// 递归算法
func fibonacciRecursive(_ num: Int) -> Int {
    if num == 0 || num == 1 {
        return num
    }
    return fibonacciRecursive(num - 1) + fibonacciRecursive(num - 2)
}

// 非递归算法
func fibonacciNonRecursive(_ num: Int) -> Int {
    if num == 0 || num == 1 {
        return num
    }

    var first = 0
    var second = 1
    var third = 0
    for _ in 2...num {
        third = first + second
        first = second
        second = third
    }
    return third
}

// Example usage
let number = 10
print("Recursive Fibonacci of \(number): \(fibonacciRecursive(number))")
print("Non-Recursive Fibonacci of \(number): \(fibonacciNonRecursive(number))")

```
