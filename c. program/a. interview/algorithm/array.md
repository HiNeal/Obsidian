## 排序 - 冒泡排序

```swift
class Solution {
    static func bubbleSort(_ arr: inout [Int]) {
        if arr.count < 2 {
            return
        }

        for end in stride(from: arr.count - 1, to: 0, by: -1) {
            var exchange = false
            for i in 0..<end {
                if arr[i] > arr[i + 1] {
                    swap(&arr, i, i + 1)
                    exchange = true
                }
            }
            if !exchange {
                break
            }
        }
    }

    static func swap(_ arr: inout [Int], _ i: Int, _ j: Int) {
        let temp = arr[i]
        arr[i] = arr[j]
        arr[j] = temp
    }
}

```

## 排序 - 选择排序

```swift
class Solution {
    static func selectionSort(_ arr: inout [Int]) {
        if arr.count < 2 {
            return
        }

        for i in 0..<arr.count - 1 {
            var minIndex = i
            for j in (i + 1)..<arr.count {
                if arr[j] < arr[minIndex] {
                    minIndex = j
                }
            }
            swap(&arr, i, minIndex)
        }
    }

    static func swap(_ arr: inout [Int], _ i: Int, _ j: Int) {
        let temp = arr[i]
        arr[i] = arr[j]
        arr[j] = temp
    }
}

```

## 排序 - 插入排序

```swift
class Solution {
    static func insertSort(_ arr: inout [Int]) {
        guard arr.count >= 2 else { return }

        for i in 1..<arr.count {
            // 就像打扑克牌排序一样，一张牌来了就从右往左遍历
            for j in stride(from: i - 1, through: 0, by: -1) {
                if arr[j] > arr[j + 1] {
                    swap(&arr, j, j + 1)
                }
            }
        }
    }

    static func swap(_ arr: inout [Int], _ i: Int, _ j: Int) {
        let temp = arr[i]
        arr[i] = arr[j]
        arr[j] = temp
    }
}

```

## 排序 - 归并排序

```swift
class Solution {
    static func mergeSort(_ arr: inout [Int]) {
        guard arr.count >= 2 else { return }
        mergeSort(&arr, 0, arr.count - 1)
    }

    static func mergeSort(_ arr: inout [Int], _ l: Int, _ r: Int) {
        if l == r {
            return
        }
        let mid = l + (r - l) / 2
        mergeSort(&arr, l, mid)
        mergeSort(&arr, mid + 1, r)
        merge(&arr, l, mid, r)
    }

    static func merge(_ arr: inout [Int], _ l: Int, _ m: Int, _ r: Int) {
        var help = [Int](repeating: 0, count: r - l + 1)
        var i = 0
        var p1 = l
        var p2 = m + 1

        while p1 <= m && p2 <= r {
            if arr[p1] < arr[p2] {
                help[i] = arr[p1]
                p1 += 1
            } else {
                help[i] = arr[p2]
                p2 += 1
            }
            i += 1
        }

        while p1 <= m {
            help[i] = arr[p1]
            i += 1
            p1 += 1
        }

        while p2 <= r {
            help[i] = arr[p2]
            i += 1
            p2 += 1
        }

        for i in 0..<help.count {
            arr[l + i] = help[i]
        }
    }
}

```

## 排序 - 堆排序

```swift
class Solution {
    static func heapSort(_ arr: inout [Int]) {
        guard arr.count >= 2 else { return }

        // 构建大根堆
        for i in 0..<arr.count {
            heapInsert(&arr, i)
        }

        var heapSize = arr.count
        // 交换堆顶和最后一个元素
        swap(&arr, 0, heapSize - 1)
        heapSize -= 1

        while heapSize > 0 {
            heapify(&arr, 0, heapSize)
            swap(&arr, 0, heapSize - 1)
            heapSize -= 1
        }
    }

    // 建立大根堆
    static func heapInsert(_ arr: inout [Int], _ index: Int) {
        var index = index
        while arr[index] > arr[(index - 1) / 2] {
            swap(&arr, index, (index - 1) / 2)
            index = (index - 1) / 2
        }
    }

    // 修正堆结构
    static func heapify(_ arr: inout [Int], _ index: Int, _ heapSize: Int) {
        var index = index
        var left = index * 2 + 1

        while left < heapSize {
            let largest = (left + 1 < heapSize && arr[left + 1] > arr[left]) ? left + 1 : left
            let largestIndex = arr[largest] > arr[index] ? largest : index

            if largestIndex == index {
                break
            }

            swap(&arr, largestIndex, index)
            index = largestIndex
            left = index * 2 + 1
        }
    }

    static func swap(_ arr: inout [Int], _ i: Int, _ j: Int) {
        let tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
    }
}

```

## 排序 - 快速排序

```swift
class Solution {
    static func quickSort(_ arr: inout [Int]) {
        guard arr.count >= 2 else { return }
        quickSort(&arr, 0, arr.count - 1)
    }

    static func quickSort(_ arr: inout [Int], _ L: Int, _ R: Int) {
        // 这个条件很重要，整个过程必须要在 L < R 下进行
        if L < R {
            // 随机选择一个数和最后一个数交换，然后采用最后一位数做标志位
            swap(&arr, L + Int.random(in: 0...(R - L)), R)
            let p = partition(&arr, L, R)
            // 递归遍历，每次确定中间的一片数字
            quickSort(&arr, L, p[0] - 1)
            quickSort(&arr, p[1] + 1, R)
        }
    }

    static func partition(_ arr: inout [Int], _ L: Int, _ R: Int) -> [Int] {
        var less = L - 1
        var more = R
        var cur = L
        // 把数组的最后一位当成了 Partition 问题中的比较数字
        while cur < more {
            if arr[cur] < arr[R] {
                swap(&arr, &less, &cur)
                less += 1
                cur += 1
            } else if arr[cur] > arr[R] {
                more -= 1
                swap(&arr, &cur, &more)
            } else {
                cur += 1
            }
        }
        // 因为最后一位并没有参与遍历，此时数组的划分为 <X | =X | >X | X 四个区域
        // 为此我们要通过 swap 函数交换为 <X | =X | >X 三个区域
        swap(&arr, more, R)
        // 返回等于区域相应的下标
        return [less + 1, more]
    }

    static func swap(_ arr: inout [Int], _ i: Int, _ j: Int) {
        let tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
    }
}

```

## 排序 - 快速衍生之荷兰国旗

```swift
class Solution {
    static func partition(_ arr: inout [Int], _ l: Int, _ r: Int, _ p: Int) -> [Int] {
        // less, more 分别是少于和大于的区域指针
        var less = l - 1
        var more = r + 1
        var cur = l

        while cur < more {
            // 当前位置的数如果少于 p 就和少于区域的下一个交换
            // 如果大于 p 就和大于区域的前一个交换
            // 如果等于就直接跳到下一个
            if arr[cur] < p {
                less += 1
                swap(&arr, less, cur)
                cur += 1
            } else if arr[cur] > p {
                // 因为刚交换过来的数还不知道大小, 所以应该先判断, 而需要指向下一个
                more -= 1
                swap(&arr, cur, more)
            } else {
                cur += 1
            }
        }
        return [less + 1, more - 1]
    }

    // for test
    static func swap(_ arr: inout [Int], _ i: Int, _ j: Int) {
        let tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
    }
}

```

## 排序 - 桶排序相邻数最大差

```swift
import Foundation

class Solution {
    static func maxGap(_ nums: [Int]) -> Int {
        if nums.isEmpty || nums.count < 2 {
            return 0
        }

        let len = nums.count
        var minNum = Int.max
        var maxNum = Int.min

        // 获取数组中最大和最小的数字
        for num in nums {
            minNum = min(minNum, num)
            maxNum = max(maxNum, num)
        }

        if minNum == maxNum {
            return 0
        }

        // 开始建立桶, 每个桶需要存放的信息是这个桶的最大值最小值以及是否有存放数字
        var hasNum = [Bool](repeating: false, count: len + 1)
        var maxs = [Int](repeating: Int.min, count: len + 1)
        var mins = [Int](repeating: Int.max, count: len + 1)

        // 开始遍历保证当前桶的最小值距离左边有存放数字的桶的最大值的差值, 记录下来
        for num in nums {
            let bid = bucket(num, len, minNum, maxNum)
            mins[bid] = hasNum[bid] ? min(mins[bid], num) : num
            maxs[bid] = hasNum[bid] ? max(maxs[bid], num) : num
            hasNum[bid] = true
        }

        var res = 0
        var lastMax = maxs[0]

        for i in 1...len {
            if hasNum[i] {
                res = max(res, mins[i] - lastMax)
                lastMax = maxs[i]
            }
        }

        return res
    }

    // 定位一个数是属于几号桶
    static func bucket(_ num: Int, _ len: Int, _ min: Int, _ max: Int) -> Int {
        return (num - min) * len / (max - min)
    }

    // for test
    static func comparator(_ nums: [Int]) -> Int {
        if nums.isEmpty || nums.count < 2 {
            return 0
        }

        let sortedNums = nums.sorted()
        var gap = Int.min

        for i in 1..<sortedNums.count {
            gap = max(sortedNums[i] - sortedNums[i - 1], gap)
        }

        return gap
    }

    // for test
    static func generateRandomArray(_ maxSize: Int, _ maxValue: Int) -> [Int] {
        let size = Int.random(in: 0...maxSize)
        return (0..<size).map { _ in
            Int.random(in: -maxValue...maxValue)
        }
    }

    // for test
    static func copyArray(_ arr: [Int]) -> [Int] {
        return arr
    }

    // for test
    static func main() {
        let testTime = 500_000
        let maxSize = 100
        let maxValue = 100
        var succeed = true

        for _ in 0..<testTime {
            let arr1 = generateRandomArray(maxSize, maxValue)
            let arr2 = copyArray(arr1)
            if maxGap(arr1) != comparator(arr2) {
                succeed = false
                break
            }
        }

        print(succeed ? "Nice!" : "Fucking fucked!")
    }
}

// 运行测试
Solution.main()

```

## 排序 - 归并衍生之有序数组

```swift
import Foundation

class Solution {
    /*
     * arr1表示数组1   m表示arr1的长度
     * arr2表示数组2   n表示arr2的长度
     */
    static func merge(_ arr1: inout [Int], _ m: Int, _ arr2: [Int], _ n: Int) {
        // 新数组下标以及新数组
        var arrIndex = 0
        var arr = [Int](repeating: 0, count: m + n)

        // 双指针
        var i = 0
        var j = 0
        while i < m && j < n {
            if arr1[i] <= arr2[j] {
                arr[arrIndex] = arr1[i]
                i += 1
            } else {
                arr[arrIndex] = arr2[j]
                j += 1
            }
            arrIndex += 1
        }

        if i < m {
            while i < m {
                arr[arrIndex] = arr1[i]
                i += 1
                arrIndex += 1
            }
        }

        if j < n {
            while j < n {
                arr[arrIndex] = arr2[j]
                j += 1
                arrIndex += 1
            }
        }

        // 把arr中从0开始的长度为整个数组的所有的数放到arr1中去
        for index in 0..<arr.count {
            arr1[index] = arr[index]
        }
    }

    static func main() {
        var num1 = [1, 2, 3, 0, 0, 0]
        let num2 = [2, 5, 6]
        let m = 3
        let n = 3
        merge(&num1, m, num2, n)
        print(num1) // 输出: [1, 2, 2, 3, 5, 6]
    }
}

// 运行测试
Solution.main()

```

## 排序 - 归并衍生之小和

```swift
import Foundation

class Solution {
    static func smallSum(_ arr: [Int]) -> Int {
        if arr.count < 2 {
            return 0
        }
        var mutableArr = arr
        return mergeSort(&mutableArr, 0, arr.count - 1)
    }

    static func mergeSort(_ arr: inout [Int], _ l: Int, _ r: Int) -> Int {
        if l == r {
            return 0
        }
        let mid = l + (r - l) / 2
        // 左边产生的小和 + 右边产生的小和 + 合并产生的小和就是整个数组的小和
        return mergeSort(&arr, l, mid) + mergeSort(&arr, mid + 1, r) + merge(&arr, l, mid, r)
    }

    static func merge(_ arr: inout [Int], _ l: Int, _ m: Int, _ r: Int) -> Int {
        // 辅助数组
        var help = [Int](repeating: 0, count: r - l + 1)
        // 辅助数组下标
        var i = 0
        // 左半边数组的指针
        var p1 = l
        // 右半边数组的指针
        var p2 = m + 1
        // 小和
        var res = 0
        // 指针没有越界
        while p1 <= m && p2 <= r {
            // 如果左边指向的值小于右边指向的值, 则 p1 位置的值一定小于 p2 以后的所有值, 因为是有序的, 这时候产生小和
            res += arr[p1] < arr[p2] ? (r - p2 + 1) * arr[p1] : 0
            help[i] = arr[p1] < arr[p2] ? arr[p1] : arr[p2]
            if arr[p1] < arr[p2] {
                p1 += 1
            } else {
                p2 += 1
            }
            i += 1
        }
        // p1 没有越界, 说明 p2 越界了, 将左边剩余元素拷贝到辅助数组
        while p1 <= m {
            help[i] = arr[p1]
            p1 += 1
            i += 1
        }
        // p2 没有越界, 说明 p1 越界了
        while p2 <= r {
            help[i] = arr[p2]
            p2 += 1
            i += 1
        }
        // 将辅助数组元素拷贝回原数组
        for i in 0..<help.count {
            arr[l + i] = help[i]
        }
        return res
    }
}

// Example usage
let nums = [1, 3, 4, 2, 5]
let result = Solution.smallSum(nums)
print("Small sum is: \(result)") // Output: Small sum is: 16

```

## 排序 - 归并衍生之逆序对

```swift
import Foundation

class Solution {
    static func smallSum(_ arr: [Int]) -> Int {
        if arr.count < 2 {
            return 0
        }
        var mutableArr = arr
        return mergeSort(&mutableArr, 0, arr.count - 1)
    }

    static func mergeSort(_ arr: inout [Int], _ l: Int, _ r: Int) -> Int {
        if l == r {
            return 0
        }
        let mid = l + (r - l) / 2
        // 左边产生的小和 + 右边产生的小和 + 合并产生的小和就是整个数组的小和
        return mergeSort(&arr, l, mid) + mergeSort(&arr, mid + 1, r) + merge(&arr, l, mid, r)
    }

    static func merge(_ arr: inout [Int], _ l: Int, _ m: Int, _ r: Int) -> Int {
        // 辅助数组
        var help = [Int](repeating: 0, count: r - l + 1)
        // 辅助数组下标
        var i = 0
        // 左半边数组的指针
        var p1 = l
        // 右半边数组的指针
        var p2 = m + 1
        // 小和
        var res = 0
        // 指针没有越界
        while p1 <= m && p2 <= r {
            // 如果左边指向的值小于右边指向的值, 则 p1 位置的值一定小于 p2 以后的所有值, 因为是有序的, 这时候产生小和
            res += arr[p1] < arr[p2] ? (r - p2 + 1) * arr[p1] : 0
            help[i] = arr[p1] < arr[p2] ? arr[p1] : arr[p2]
            if arr[p1] < arr[p2] {
                p1 += 1
            } else {
                p2 += 1
            }
            i += 1
        }
        // p1 没有越界, 说明 p2 越界了, 将左边剩余元素拷贝到辅助数组
        while p1 <= m {
            help[i] = arr[p1]
            p1 += 1
            i += 1
        }
        // p2 没有越界, 说明 p1 越界了
        while p2 <= r {
            help[i] = arr[p2]
            p2 += 1
            i += 1
        }
        // 将辅助数组元素拷贝回原数组
        for i in 0..<help.count {
            arr[l + i] = help[i]
        }
        return res
    }
}

// Example usage
let nums = [1, 3, 4, 2, 5]
let result = Solution.smallSum(nums)
print("Small sum is: \(result)") // Output: Small sum is: 16

```

## 两数之和

```swift
/**
 * 题目: 给定一个整数数组 nums 和一个整数目标值 target, 请你在该数组中找出和为目标值 target 的那两个整数, 并返回它们的数组下标;
 *     你可以假设每种输入只会对应一个答案, 但是数组中同一个元素在答案里不能重复出现;
 *
 * 输入: nums = [2,7,11,15], target = 9
 * 输出: [0,1]
 * 解释: 因为 nums[0] + nums[1] == 9, 返回 [0, 1]
 */

class Solution {
    static func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
        var map = [Int: Int]()
        for (i, num) in nums.enumerated() {
            let pair = target - num
            if let pairIndex = map[pair] {
                return [pairIndex, i]
            }
            map[num] = i
        }
        fatalError("No two sum solution")
    }
}

// Example usage
let nums = [2, 7, 11, 15]
let target = 9
let result = Solution.twoSum(nums, target)
print(result) // Output: [0, 1]

```

## 合并有序数组

import Foundation

/**
 * 题目: 给你两个按非递减顺序排列的整数数组 nums1 和 nums2, 另有两个整数 m 和 n, 分别表示 nums1 和 nums2 中的元素数目;
 *       请你合并 nums2 到 nums1 中, 使合并后的数组同样按非递减顺序排列, 最终, 合并后数组不应由函数返回, 而是存储在数组 nums1 中;
 *       为了应对这种情况, nums1 的初始长度为 m + n, 其中前 m 个元素表示应合并的元素, 后 n 个元素为 0, 应忽略。nums2 的长度为 n;
 *
 * 输入: nums1 = [1,2,3,0,0,0], m = 3, nums2 = [2,5,6], n = 3
 * 输出: [1,2,2,3,5,6]
 * 解释: 需要合并 [1,2,3] 和 [2,5,6]。
 */

class Solution {
    static func merge(_ nums1: inout [Int], _ m: Int, _ nums2: [Int], _ n: Int) {
        var help = [Int](repeating: 0, count: m + n)
        var i = 0
        var p1 = 0
        var p2 = 0

        while p1 < m && p2 < n {
            if nums1[p1] <= nums2[p2] {
                help[i] = nums1[p1]
                p1 += 1
            } else {
                help[i] = nums2[p2]
                p2 += 1
            }
            i += 1
        }

        while p1 < m {
            help[i] = nums1[p1]
            p1 += 1
            i += 1
        }

        while p2 < n {
            help[i] = nums2[p2]
            p2 += 1
            i += 1
        }

        for index in 0..<help.count {
            nums1[index] = help[index]
        }
    }
}

// Example usage
var nums1 = [1, 2, 3, 0, 0, 0]
let nums2 = [2, 5, 6]
let m = 3
let n = 3
Solution.merge(&nums1, m, nums2, n)
print(nums1) // 输出: [1, 2, 2, 3, 5, 6]

## 移除目标元素

```swift
import Foundation

/**
 * 题目: 给你一个数组 nums 和一个值 value, 你需要原地移除所有数值等于 value 的元素, 并返回移除后数组的新长度;
 *     不要使用额外的数组空间, 你必须仅使用 O(1) 额外空间并原地修改输入数组;
 *     元素的顺序可以改变, 你不需要考虑数组中超出新长度后面的元素;
 *
 * 输入: nums = [0,1,2,2,3,0,4,2], value = 2
 * 输出: 5, nums = [0,1,4,0,3]
 * 解释: 函数应该返回新的长度 5, 并且 nums 中的前五个元素为 0, 1, 3, 0, 4;
 *       注意这五个元素可为任意顺序。你不需要考虑数组中超出新长度后面的元素。
 */

class Solution {
    static func removeElement(_ nums: inout [Int], _ value: Int) -> Int {
        var left = 0
        for right in 0..<nums.count {
            if nums[right] != value {
                nums[left] = nums[right]
                left += 1
            }
        }
        return left
    }
}

// Example usage
var nums = [0, 1, 2, 2, 3, 0, 4, 2]
let value = 2
let newLength = Solution.removeElement(&nums, value)
print("New length: \(newLength), Modified array: \(nums.prefix(newLength))") // 输出: New length: 5, Modified array: [0, 1, 3, 0, 4]

```

## 删除有序数组中的重复项

```swift
import Foundation

/**
 * 题目: 给你一个升序排列的数组 nums, 请你原地删除重复出现的元素, 使每个元素只出现一次, 返回删除后数组的新长度;
 *      元素的相对顺序应该保持一致, 然后返回 nums 中唯一元素的个数;
 *
 * 输入: nums = [1,1,2]
 * 输出: 2, nums = [1,2,_]
 * 解释: 函数应该返回新的长度 2, 并且原数组 nums 的前两个元素被修改为 1, 2; 不需要考虑数组中超出新长度后面的元素;
 */

class Solution {
    static func removeDuplicates(_ nums: inout [Int]) -> Int {
        guard nums.count > 1 else { return nums.count }

        var left = 0
        for right in 1..<nums.count {
            // 找到不重复的元素赋值到数组的开头
            if nums[right] != nums[left] {
                left += 1
                nums[left] = nums[right]
            }
        }
        return left + 1
    }
}

// Example usage
var nums = [1, 1, 2]
let newLength = Solution.removeDuplicates(&nums)
print("New length: \(newLength), Modified array: \(nums.prefix(newLength))") // 输出: New length: 2, Modified array: [1, 2]

```

## 查找 - 二分

```swift
import Foundation

class Solution {
    static func binarySearch(_ arr: [Int], _ target: Int) -> Int {
        var left = 0
        var right = arr.count - 1
        var middle = 0

        // Check if the target is out of the bounds of the array
        if left > right || target < arr[left] || target > arr[right] {
            return -1
        }

        while left <= right {
            middle = (right + left) / 2
            if target > arr[middle] {
                left = middle + 1
            } else if target < arr[middle] {
                right = middle - 1
            } else {
                return middle
            }
        }

        return -1
    }
}

```

## 查找 - 二维数组

```swift
import Foundation

/**
 * 题目: 在一个二维数组中, 每一行都按照从左到右递增的顺序排序, 每一列都按照从上到下递增的顺序排序;
 *      请完成一个函数, 输入这样的一个二维数组和一个整数, 判断数组中是否含有该整数;
 */

class Solution {
    static func findNum(_ arr: [[Int]], _ target: Int) -> Bool {
        // 基本条件判断
        if arr.isEmpty || arr[0].isEmpty {
            return false
        }

        var row = 0
        var column = arr[0].count - 1

        while row < arr.count && column >= 0 {
            if target > arr[row][column] {
                row += 1
            } else if target < arr[row][column] {
                column -= 1
            } else {
                return true
            }
        }

        return false
    }
}

// Example usage
let matrix = [
    [1, 4, 7, 11, 15],
    [2, 5, 8, 12, 19],
    [3, 6, 9, 16, 22],
    [10, 13, 14, 17, 24],
    [18, 21, 23, 26, 30]
]
let target = 5
let result = Solution.findNum(matrix, target)
print("Is target \(target) found in matrix? \(result)") // Output: Is target 5 found in matrix? true

```

## 有序数组的平方

```swift
import Foundation

/**
 * 题目: 给你一个按非递减顺序排序的整数数组 nums, 返回每个数字的平方组成的新数组,
 *     要求也按非递减顺序排序;
 */

class Solution {
    static func sortedSquares(_ arr: [Int]) -> [Int] {
        var left = 0
        var right = arr.count - 1
        var res = [Int](repeating: 0, count: arr.count)
        var j = arr.count - 1

        while left <= right {
            if arr[left] * arr[left] > arr[right] * arr[right] {
                res[j] = arr[left] * arr[left]
                left += 1
            } else {
                res[j] = arr[right] * arr[right]
                right -= 1
            }
            j -= 1
        }
        return res
    }
}

// Example usage
let nums = [-4, -1, 0, 3, 10]
let result = Solution.sortedSquares(nums)
print("Sorted squares: \(result)") // Output: Sorted squares: [0, 1, 9, 16, 100]

```

## 长度最小的子数组

```swift
import Foundation

/**
 * 题目: 给定一个含有 n 个正整数的数组和一个正整数 target, 找出该数组中满足其总和大于等于 target 的长度最小的连续子数组, 并返回其长度;
 *     如果不存在符合条件的子数组返回 0;
 *
 * 示例1: 输入 target = 7, nums = [2,3,1,2,4,3],
 *       输出 2 (子数组 [4,3] 是该条件下的长度最小的子数组)
 */

class Solution {
    static func minSubArrayLen(_ s: Int, _ nums: [Int]) -> Int {
        var left = 0
        var sum = 0
        var result = Int.max

        for right in 0..<nums.count {
            sum += nums[right]
            while sum >= s {
                result = min(result, right - left + 1)
                sum -= nums[left]
                left += 1
            }
        }

        return result == Int.max ? 0 : result
    }
}

// Example usage
let target = 7
let nums = [2, 3, 1, 2, 4, 3]
let result = Solution.minSubArrayLen(target, nums)
print("Minimum length of subarray: \(result)") // Output: Minimum length of subarray: 2

```
