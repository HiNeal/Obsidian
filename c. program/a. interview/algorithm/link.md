## 链表 - 反转链表

```swift
class Solution {
    class Node {
        var value: Int
        var next: Node?

        init(_ x: Int) {
            self.value = x
        }
    }

    // 递归解法
    func reverseList1(_ head: Node?) -> Node? {
        guard let head = head, let next = head.next else {
            return head
        }

        let newHead = reverseList1(next)
        head.next?.next = head
        head.next = nil
        return newHead
    }

    // 非递归解法
    func reverseList2(_ head: Node?) -> Node? {
        if head == nil || head?.next == nil {
            return head
        }

        var newHead: Node? = nil
        var current = head

        while current != nil {
            let tmpNode = current?.next
            current?.next = newHead
            newHead = current
            current = tmpNode
        }
        return newHead
    }
}

```

## 链表 - 判断链表是否有环

```swift
/*
 * 给定一个链表判断链表中是否有环
 */

 class Solution {
    class Node {
        var value: Int
        var next: Node?

        init(_ x: Int) {
            self.value = x
        }
    }

    func hasCycle(_ head: Node?) -> Bool {
        if head == nil || head?.next == nil {
            return false
        }

        var slow = head
        var fast = head?.next

        while fast != nil && fast?.next != nil {
            if slow === fast {
                return true
            }
            slow = slow?.next
            fast = fast?.next?.next
        }
        return false
    }
}

```

## 链表 - 判断一个链表是否为回文结构

```swift

import Foundation

class Solution {
    class Node {
        var value: Int
        var next: Node?

        init(_ data: Int) {
            self.value = data
        }
    }
    // need n extra space
    func isPalindrome1(_ head: Node?) -> Bool {
        var stack = [Node
        ]()
        var current = head

        while let node = current {
            stack.append(node)
            current = node.next
        }

        current = head
        while let node = current {
            if node.value != stack.removeLast().value {
                return false
            }
            current = node.next
        }

        return true
    }
}

```

## 链表 - 打印两个有序链表的公共部分

```swift
import Foundation

class Solution {
    class Node {
        var value: Int
        var next: Node?

        init(_ data: Int) {
            self.value = data
        }
    }

    func printCommonPart(_ head1: Node?, _ head2: Node?) {
        print("Common Part: ", terminator: "")
        var head1 = head1
        var head2 = head2

        while let h1 = head1, let h2 = head2 {
            if h1.value < h2.value {
                head1 = h1.next
            } else if h1.value > h2.value {
                head2 = h2.next
            } else {
                print("\(h1.value) ", terminator: "")
                head1 = h1.next
                head2 = h2.next
            }
        }
        print()
    }

    func printLinkedList(_ node: Node?) {
        print("Linked List: ", terminator: "")
        var current = node
        while let node = current {
            print("\(node.value) ", terminator: "")
            current = node.next
        }
        print()
    }

    func main() {
        let node1 = Node(2)
        node1.next = Node(3)
        node1.next?.next = Node(5)
        node1.next?.next?.next = Node(6)

        let node2 = Node(1)
        node2.next = Node(2)
        node2.next?.next = Node(5)
        node2.next?.next?.next = Node(7)
        node2.next?.next?.next?.next = Node(8)

        printLinkedList(node1)
        printLinkedList(node2)
        printCommonPart(node1, node2)
    }
}

```

## 链表 - 单向循环链表

```swift
import Foundation

class Solution {
    class Node {
        var value: Int
        var next: Node?

        init(_ data: Int) {
            self.value = data
        }
    }

    func printCommonPart(_ head1: Node?, _ head2: Node?) {
        print("Common Part: ", terminator: "")
        var head1 = head1
        var head2 = head2

        while let h1 = head1, let h2 = head2 {
            if h1.value < h2.value {
                head1 = h1.next
            } else if h1.value > h2.value {
                head2 = h2.next
            } else {
                print("\(h1.value) ", terminator: "")
                head1 = h1.next
                head2 = h2.next
            }
        }
        print()
    }

    func printLinkedList(_ node: Node?) {
        print("Linked List: ", terminator: "")
        var current = node
        while let node = current {
            print("\(node.value) ", terminator: "")
            current = node.next
        }
        print()
    }

    func main() {
        let node1 = Node(2)
        node1.next = Node(3)
        node1.next?.next = Node(5)
        node1.next?.next?.next = Node(6)

        let node2 = Node(1)
        node2.next = Node(2)
        node2.next?.next = Node(5)
        node2.next?.next?.next = Node(7)
        node2.next?.next?.next?.next = Node(8)

        printLinkedList(node1)
        printLinkedList(node2)
        printCommonPart(node1, node2)
    }
}

```

## 链表 - 双向循环链表

```swift
import Foundation

class CircleLinkedList<E: Equatable> {
    // 内部元素的个数
    private var size = 0
    private var first: Node<E>?
    private var last: Node<E>?
    private var current: Node<E>?

    // 不存在元素
    private static let ELEMENT_NOT_FOUND = -1

    // 构建Node节点类
    private class Node<E> {
        var element: E
        var prev: Node?
        var next: Node?

        init(_ prev: Node?, _ element: E, _ next: Node?) {
            self.prev = prev
            self.element = element
            self.next = next
        }

        func description() -> String {
            var sb = ""

            if let prev = prev {
                sb.append("\(prev.element)")
            } else {
                sb.append("null")
            }

            sb.append("_\(element)_")

            if let next = next {
                sb.append("\(next.element)")
            } else {
                sb.append("null")
            }

            return sb
        }
    }

    // 在index位置插入一个元素
    func add(_ index: Int, _ element: E) {
        rangeCheckForAdd(index)

        if index == size { // 往最后面添加元素
            let oldLast = last
            last = Node(oldLast, element, first)
            if oldLast == nil { // 这是链表添加的第一个元素
                first = last
                first?.next = first
                first?.prev = first
            } else {
                oldLast?.next = last
                first?.prev = last
            }
        } else {
            let next = node(index)
            let prev = next?.prev
            let newNode = Node(prev, element, next)
            next?.prev = newNode
            prev?.next = newNode

            if next === first { // index == 0
                first = newNode
            }
        }

        size += 1
    }

    // 删除index位置的元素
    func remove(_ index: Int) -> E {
        rangeCheck(index)
        return remove(node(index)!)
    }

    private func remove(_ node: Node<E>) -> E {
        if size == 1 {
            first = nil
            last = nil
        } else {
            let prev = node.prev
            let next = node.next
            prev?.next = next
            next?.prev = prev

            if node === first { // index == 0
                first = next
            }

            if node === last { // index == size - 1
                last = prev
            }
        }

        size -= 1
        return node.element
    }

    // 删除当前节点
    func remove() -> E? {
        guard let current = current else { return nil }

        let next = current.next
        let element = remove(current)
        self.current = size == 0 ? nil : next

        return element
    }

    // 清除所有元素
    func clear() {
        size = 0
        first = nil
        last = nil
    }

    // 获取index位置的元素
    func get(_ index: Int) -> E {
        return node(index)!.element
    }

    // 内部元素的个数
    func size() -> Int {
        return size
    }

    // 是否为空
    func isEmpty() -> Bool {
        return size == 0
    }

    // 是否包含某个节点
    func contains(_ element: E) -> Bool {
        return indexOf(element) != CircleLinkedList.ELEMENT_NOT_FOUND
    }

    // 重置current指针
    func reset() {
        current = first
    }

    // 移动到下一个节点
    func next() -> E? {
        guard let current = current else { return nil }

        self.current = current.next
        return current.element
    }

    // 设置index位置的元素
    func set(_ index: Int, _ element: E) -> E {
        let node = self.node(index)!
        let old = node.element
        node.element = element
        return old
    }

    // 获取元素对应的index
    func indexOf(_ element: E) -> Int {
        var node = first
        for i in 0..<size {
            if node?.element == element {
                return i
            }
            node = node?.next
        }
        return CircleLinkedList.ELEMENT_NOT_FOUND
    }

    // 获取index位置的节点
    private func node(_ index: Int) -> Node<E>? {
        rangeCheck(index)

        if index < (size >> 1) {
            var node = first
            for _ in 0..<index {
                node = node?.next
            }
            return node
        } else {
            var node = last
            for _ in stride(from: size - 1, to: index, by: -1) {
                node = node?.prev
            }
            return node
        }
    }

    // 普通抛出异常
    private func rangeCheck(_ index: Int) {
        if index < 0 || index >= size {
            outOfBounds(index)
        }
    }

    // 做加法抛出异常
    private func rangeCheckForAdd(_ index: Int) {
        if index < 0 || index > size {
            outOfBounds(index)
        }
    }

    // 抛出异常
    private func outOfBounds(_ index: Int) {
        fatalError("Index: \(index), Size: \(size)")
    }

    // 重写toString方法, 打印链表
    func description() -> String {
        var string = "size=\(size), ["
        var node = first
        for i in 0..<size {
            if i != 0 {
                string.append(", ")
            }
            string.append(node!.description())
            node = node?.next
        }
        string.append("]")
        return string
    }
}

```
