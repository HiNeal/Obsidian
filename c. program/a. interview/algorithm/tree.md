## 二叉树 - 前序遍历

```swift

import Foundation

class Solution {
    class Node {
        var value: Int
        var left: Node?
        var right: Node?

        init(_ data: Int) {
            self.value = data
        }
    }

    // 递归前序遍历
    static func preOrderRecur(_ head: Node?) {
        guard let head = head else {
            return
        }
        print(head.value, terminator: " ")
        preOrderRecur(head.left)
        preOrderRecur(head.right)
    }

    // 非递归前序遍历
    static func preOrderUnRecur(_ head: Node?) {
        guard let head = head else {
            return
        }
        var stack = [Node]()
        stack.append(head)

        while !stack.isEmpty {
            let node = stack.removeLast()
            print(node.value, terminator: " ")

            if let right = node.right {
                stack.append(right)
            }
            if let left = node.left {
                stack.append(left)
            }
        }
    }
}

// Example usage
let root = Solution.Node(1)
root.left = Solution.Node(2)
root.right = Solution.Node(3)
root.left?.left = Solution.Node(4)
root.left?.right = Solution.Node(5)

print("Recursive Pre-Order Traversal:")
Solution.preOrderRecur(root)

print("\nNon-Recursive Pre-Order Traversal:")
Solution.preOrderUnRecur(root)

```

## 二叉树 - 中序遍历

```swift
import Foundation

class Solution {
    class Node {
        var value: Int
        var left: Node?
        var right: Node?

        init(_ data: Int) {
            self.value = data
        }
    }

    // 递归中序遍历
    static func inOrderRecur(_ head: Node?) {
        guard let head = head else {
            return
        }
        inOrderRecur(head.left)
        print(head.value, terminator: " ")
        inOrderRecur(head.right)
    }

    // 非递归中序遍历
    static func inOrderUnRecur(_ head: Node?) {
        guard var head = head else {
            return
        }
        var stack = [Node]()

        while !stack.isEmpty || head != nil {
            if let current = head {
                // 当前节点不为空则将其压入栈然后当前节点往左
                stack.append(current)
                head = current.left
            } else {
                // 当前节点为空从栈拿一个打印,然后当前节点往右边跑
                head = stack.removeLast()
                print(head!.value, terminator: " ")
                head = head!.right
            }
        }
    }
}

// Example usage
let root = Solution.Node(1)
root.left = Solution.Node(2)
root.right = Solution.Node(3)
root.left?.left = Solution.Node(4)
root.left?.right = Solution.Node(5)

print("Recursive In-Order Traversal:")
Solution.inOrderRecur(root)

print("\nNon-Recursive In-Order Traversal:")
Solution.inOrderUnRecur(root)

```

## 二叉树 - 后序遍历

```swift
import Foundation

class Solution {
    class Node {
        var value: Int
        var left: Node?
        var right: Node?

        init(_ data: Int) {
            self.value = data
        }
    }

    // 递归中序遍历
    static func inOrderRecur(_ head: Node?) {
        guard let head = head else {
            return
        }
        inOrderRecur(head.left)
        print(head.value, terminator: " ")
        inOrderRecur(head.right)
    }

    // 非递归中序遍历
    static func inOrderUnRecur(_ head: Node?) {
        guard var head = head else {
            return
        }
        var stack = [Node]()

        while !stack.isEmpty || head != nil {
            if let current = head {
                // 当前节点不为空则将其压入栈然后当前节点往左
                stack.append(current)
                head = current.left
            } else {
                // 当前节点为空从栈拿一个打印,然后当前节点往右边跑
                head = stack.removeLast()
                print(head!.value, terminator: " ")
                head = head!.right
            }
        }
    }
}

// Example usage
let root = Solution.Node(1)
root.left = Solution.Node(2)
root.right = Solution.Node(3)
root.left?.left = Solution.Node(4)
root.left?.right = Solution.Node(5)

print("Recursive In-Order Traversal:")
Solution.inOrderRecur(root)

print("\nNon-Recursive In-Order Traversal:")
Solution.inOrderUnRecur(root)

```

## 二叉树 - 层序遍历

```swift
import Foundation

class Solution {
    class Node {
        var value: Int
        var left: Node?
        var right: Node?

        init(_ data: Int) {
            self.value = data
        }
    }

    // 层序遍历
    static func levelRead(_ head: Node?) {
        // 当结点非空时才进行操作
        guard let head = head else {
            return
        }

        // 用于存放还未遍历的元素
        var queue = [Node]()
        // 将根结点入队
        queue.append(head)

        // 队列非空则进行处理
        while !queue.isEmpty {
            // 删除队首元素
            let current = queue.removeFirst()
            // 输出队首元素的值
            print(current.value, terminator: " ")

            // 如果左子结点不为空,则左子结点入队
            if let left = current.left {
                queue.append(left)
            }
            // 如果右子结点不为空,则右子结点入队
            if let right = current.right {
                queue.append(right)
            }
        }
    }
}

// Example usage
let root = Solution.Node(1)
root.left = Solution.Node(2)
root.right = Solution.Node(3)
root.left?.left = Solution.Node(4)
root.left?.right = Solution.Node(5)

print("Level-Order Traversal:")
Solution.levelRead(root)

```

## 二叉树 - 判断平衡二叉树

```swift
import Foundation

/*
 * 判断一颗二叉树是否是平衡二叉树,它是一棵空树或任意节点左右两个子树的高度差的绝对值不超过1称为平衡二叉树
 *
 * 此题充分体现了递归对于解决树相关算法题的作用,如果抛开先序中序后序的打印时机,其实递归来到每个节点的次数是三次
 * 既然可以回到要给节点三次,我们就可以收集左子树和右子树的信息最后回到根节点,进行判断,可以总结为一个高度解题套路
 * 如为了判断X为根节点的树是不是平衡树,可以先判断节点X的左树是否平衡,右树是否平衡,再获取左右树高度比较是否超过1
 * 套路就是要设计我们的递归返回结构,对于这道题来说我们需要递归函数给我们返回信息包括了这棵树是否平衡和这棵树高度;
 */

class Solution {
    class Node {
        var value: Int
        var left: Node?
        var right: Node?

        init(_ data: Int) {
            self.value = data
        }
    }

    // 设计递归的返回结构
    struct ReturnData {
        // 是否是平衡二叉树
        var isBalance: Bool
        // 树的高度
        var height: Int

        init(_ isBalance: Bool, _ height: Int) {
            self.isBalance = isBalance
            self.height = height
        }
    }

    static func isBalanceTree(_ head: Node?) -> Bool {
        return process(head).isBalance
    }

    // 设计递归函数,返回信息包括该树是否是平衡二叉树以及该树的高度
    static func process(_ head: Node?) -> ReturnData {
        // 如果是空树认为也算是平衡二叉树
        guard let head = head else {
            return ReturnData(true, 0)
        }

        let leftData = process(head.left)
        // 如果左树已经是不平衡直接返回不平衡
        if !leftData.isBalance {
            return ReturnData(false, 0)
        }

        let rightData = process(head.right)
        // 如果右树已经是不平衡直接返回不平衡
        if !rightData.isBalance {
            return ReturnData(false, 0)
        }

        // 说明左树和右树都已经平衡了
        if abs(leftData.height - rightData.height) > 1 {
            return ReturnData(false, 0)
        }

        // return在递归中很重要,左树和右树高度较大的那个加1就是我自己的高度
        return ReturnData(true, max(leftData.height, rightData.height) + 1)
    }
}

// Example usage
let root = Solution.Node(1)
root.left = Solution.Node(2)
root.right = Solution.Node(3)
root.left?.left = Solution.Node(4)
root.left?.right = Solution.Node(5)

print("Is Balanced Tree: \(Solution.isBalanceTree(root))")

```

## 二叉树 - 判断完全二叉树

```swift

import Foundation

/*
 * 如何判断一个数是否是完全二叉树,按层一个节点一个节点遍历,每个节点需要满足下面两个条件
 * 第一阶段：如果一个节点只有右孩子没有左孩子绝对不是完全二叉树,可以直接返回false
 * 第二阶段：如果一个节点不是左右两个孩子都全(那么这里要么是有左孩子没有右孩子要么是左右都没有孩子),
 *         那么在这样的情况下按层遍历如果未遍历的节点都是叶子节点则说明是完全二叉树
 */

class Solution {
    class Node {
        var value: Int
        var left: Node?
        var right: Node?

        init(_ data: Int) {
            self.value = data
        }
    }

    static func isCompleteBinaryTree(_ head: Node?) -> Bool {
        guard let head = head else {
            return true
        }

        var queue = [Node]()
        // 标志是否进入了第二阶段,开启后续节点都是叶节点的这样一个阶段
        var leaf = false
        queue.append(head)

        while !queue.isEmpty {
            let current = queue.removeFirst()
            let l = current.left
            let r = current.right

            // 这个if语句中有两个判断条件：
            // 第一个条件：如果我开启了第二阶段了 并且左孩子不为空或者右孩子不为空 (标准二)
            // 第二个条件：左孩子为空,右孩子也不为空(标准一)
            if (leaf && (l != nil || r != nil)) || (l == nil && r != nil) {
                return false
            }

            if let left = l {
                queue.append(left)
            }
            if let right = r {
                queue.append(right)
            }

            if l == nil || r == nil {
                // 进入第二阶段
                leaf = true
            }
        }

        return true
    }
}

// Example usage
let root = Solution.Node(1)
root.left = Solution.Node(2)
root.right = Solution.Node(3)
root.left?.left = Solution.Node(4)
root.left?.right = Solution.Node(5)

print("Is Complete Binary Tree: \(Solution.isCompleteBinaryTree(root))")

```

## 二叉树 - 判断搜索二叉树

```swift

import Foundation

/*
 * 判断一棵树是否是搜索二叉树,左子树值比自己小,右子树值比自己大。
 * 判断一棵树是否是搜索二叉树,其实只要满足二叉树中序遍历结果是依次升序的就是搜索二叉树
 */

class Solution {
    class Node {
        var value: Int
        var left: Node?
        var right: Node?

        init(_ data: Int) {
            self.value = data
        }
    }

    static func isBST(_ head: Node?) -> Bool {
        guard let head = head else {
            return true
        }

        var stack = [Node]()
        var current: Node? = head
        var prevValue: Int? = nil

        while !stack.isEmpty || current != nil {
            if let node = current {
                stack.append(node)
                current = node.left
            } else {
                current = stack.removeLast()
                // 当前这个数是否比前一个数小则不满足搜索二叉树
                if let prevValue = prevValue, current!.value <= prevValue {
                    return false
                }
                prevValue = current!.value
                current = current!.right
            }
        }

        return true
    }
}

// Example usage
let root = Solution.Node(2)
root.left = Solution.Node(1)
root.right = Solution.Node(3)

print("Is Binary Search Tree: \(Solution.isBST(root))")

```

## 二叉树 - 查找后继节点

```swift
import Foundation

/*
 * 解题规律:
 * 1.首先我们要明白后继节点值得是,在二叉树中序遍历序列中,node的下一个节点叫做node的后继节点
 * 2.如果节点X有右子树,那么该节点的后继节点一定是其右子树最左的节点(结合中序遍历思考得出);
 * 3.如果节点X没有右子树,通过节点X的parent指针找节点X的父节点,一直往上找,直到节点X是该某个节点的左孩子,
 *   那么这个某个节点就是X节点的后继节点
 */

class Solution {
    class Node {
        var value: Int
        var left: Node?
        var right: Node?
        var parent: Node?

        init(_ data: Int) {
            self.value = data
        }
    }

    static func getSuccessorNode(_ node: Node?) -> Node? {
        guard let node = node else {
            return nil
        }

        if let right = node.right {
            // 如果一个节点有右子树,直接找到这颗右子树上最左的节点
            return getLeftMost(right)
        } else {
            var current = node
            var parent = node.parent
            // parent != nil处理边界值,parent.left != node当前节点等于自己的左孩子停
            while parent != nil && parent?.left !== current {
                current = parent!
                parent = current.parent
            }
            return parent
        }
    }

    // 拿到右子树上最左的节点
    static func getLeftMost(_ node: Node?) -> Node? {
        guard var node = node else {
            return nil
        }
        while let left = node.left {
            node = left
        }
        return node
    }
}

// Example usage
let root = Solution.Node(1)
let leftChild = Solution.Node(2)
let rightChild = Solution.Node(3)
root.left = leftChild
root.right = rightChild
leftChild.parent = root
rightChild.parent = root

if let successor = Solution.getSuccessorNode(leftChild) {
    print("Successor of \(leftChild.value) is \(successor.value)")
} else {
    print("No successor found")
}

```
