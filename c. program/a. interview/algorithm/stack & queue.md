## 队列 - 用数组结构实现固定的队列

```swift
import Foundation

class ArrayQueue {
    private var arr: [Int?]
    // 用 size 把 first 和 end 追的行为解耦掉
    private var size: Int
    // 表示如果拿出一个数应该拿哪里的数
    private var first: Int
    // 表示如果新加一个数应该填到哪里的数
    private var last: Int

    init(initSize: Int) {
        guard initSize >= 0 else {
            fatalError("The init size is less than 0")
        }
        arr = Array(repeating: nil, count: initSize)
        size = 0
        first = 0
        last = 0
    }

    func peek() -> Int? {
        if size == 0 {
            return nil
        }
        return arr[first]
    }

    func push(_ obj: Int) {
        if size == arr.count {
            fatalError("The queue is full")
        }
        size += 1
        arr[last] = obj
        last = last == arr.count - 1 ? 0 : last + 1
    }

    func poll() -> Int {
        if size == 0 {
            fatalError("The queue is empty")
        }
        size -= 1
        let tmp = first
        first = first == arr.count - 1 ? 0 : first + 1
        return arr[tmp]!
    }
}

```

## 栈 - 用数组结构实现固定的栈

```swift
import Foundation

class Stack<E> {
    private var list = [E]()

    func push(_ element: E) {
        list.append(element)
    }

    func pop() -> E {
        return list.removeLast()
    }

    func top() -> E {
        return list.last!
    }

    func clear() {
        list.removeAll()
    }

    func size() -> Int {
        return list.count
    }

    func isEmpty() -> Bool {
        return list.isEmpty
    }
}

```
