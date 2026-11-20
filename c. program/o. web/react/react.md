## jSX - 基础

```jsx
/**
 * JSX基础认识
 *
 * - JSX(JS & XML)标签本质是React通过createElement创建虚拟DOM的语法糖,便于开发人员更快创建虚拟DOM;
 * - 虚拟DOM本质是JS对象,React会负责将所有的虚拟DOM转化为真实DOM节点挂载到根节点下;
 * - JSX标签中如果需要混入JS代码必须使用{},同时{}内也必须使用表达式而非语句,两者区别为表达式是用于计算并最终会有返回值;
 * - JSX标签只能有一个根标签且所有标签必须闭合,小写开头标签会转为html中同名标签,大写开头标签则由React会渲染对应组件;
 * - JSX标签样式指定不可使用class,需要使用className,内敛样式要使用style={{key:value}},外部{}表示要混入JS表达式,内部表示JS对象;
 */

```

## 组件 - 定义 - 类

```jsx
import React from "react";

class ContainView extends React.Component {
  // 初始化
  constructor() {

  }

  // 组件挂载完毕
  componentDidMount() {

  }

  // 渲染
  render() {
    return <div>Hello World</div>;
  }
}

export default ContainView;

```

## 组件 - 定义 - 函数

```jsx
function $ContainView() {
  const initData = {attr1: 'value1', attr1: 'value2'}
  const [data, setData] = useState(initData)
  const handleClick = () => {
    setData(() => {
      return {
        ...data,
        attr1: newValue1,
      }
    })
  }

  useEffect(()=>{
    // 首次挂载调用
  },[])

  useEffect(()=>{
    // 定义副作用
    return () => {
      // 消除副作用
    }
  })

  useEffect(()=>{
    // 监听数据变化调用
  },[data])

  return (
    <div>
      <p>{data.age}</p>
      <button onClick={handleClick}>
          click
      </button>
    </div>
  )
}

export default $ContainView

```

## 生命周期 - 挂载

```jsx
// 初始化
constructor() {

}

// 若state在任何时候都取决于props则可以使用
static getDerivedStateFromProps(props, state){
    return null
}

// 渲染
render() {

}

// 组件挂载完毕
componentDidMount() {

}

```

## 生命周期 - 更新

```jsx
// 初始化
constructor() {

}

// 若state在任何时候都取决于props则可以使用
static getDerivedStateFromProps(props, state){
    return null
}

shouldComponentUpdate() {

}

// 渲染
render() {

}

// 更新前获取快照
getSnapshotBeforeUpdate(preProps,preState) {

}

// 组件挂载完毕
componentDidUpdate(preProps,preStates,snapShot) {

}

```

## 生命周期 - 卸载

```jsx
// 组件即将卸载
componentWillUnmount() {

}

```

## hook - State

```jsx
import React, { useState } from "react";

const ContainView = (props) => {
  const initalData1 = 0
  const initalData2 = { attr1: "value1", attr2: "value2" }
  const initalData3 = () => {
    return props > 100 ? 1 : 2
  }
  const [data1, setData1] = useState(initalData1) // 原始类型
  const [data2, setData2] = useState(initalData2) // 对象类型
  const [data3, setData3] = useState(initalData3) // 函数类型

  const buttonClick1 = () => {
    setData1(() => {
      return data1 + 1
    })
  }

  const buttonClick2 = () => {
    setData2({ ...data2, attr1: "newValue" })
  }

  const buttonClick3 = () => {
    setData3(() => {
      return 100
    })
  }

  return (
    <div>
      <p>{data1}</p>
      <button onClick={buttonClick1}>click</button>

      <p>{data2.attr1}</p>
      <button onClick={buttonClick2}>click</button>

      <p>{data3}</p>
      <button onClick={buttonClick3}>click</button>
    </div>
  )
}

export default ContainView

```

## hook - Effect

```jsx
import React, {useState, useEffect } from "react";

function ContainView() {
  const [data, setData] = useState(0)
  const buttonClick = () => {
    setData(() => { return data + 1 })
  }

  useEffect(()=>{
    console.log('首次和重新渲染后调用该副作用(副作用依赖所有值)')
  })

  useEffect(()=>{
    console.log('首次渲染后调用该副作用(副作用不依赖任何值)')
  },[])

  useEffect(()=>{
    console.log('首次和重新渲染后调用该副作用(副作用依赖所有值)')
    return () => {
        console.log('清除上次渲染定义的副作用)')
    }
  })

  useEffect(()=>{
    console.log('数据状态变化进而渲染后调用该副作用(副作用依赖指定值)')
  },[data])

  return (
    <div>
      <p>{data}</p>
      <button onClick={buttonClick}> click </button>
    </div>
  )
}

export default ContainView

/**
 * useEffect
 *
 * - React希望我们定义的都是纯组件,这显然不符合业务场景,所以提供了这些hook;
 * - useEffect用来定义组件渲染的系列副作用;
 */

```

## hook - Context

```jsx
import React, {useState, createContext, useContext} from "react"

/**
 * TransferContext
 * import {createContext} from 'react'
 */
export const TransferContext = React.createContext(0)

/**
 * ParentView
 *
 * import {useState} from 'react'
 * import {TransferContext} from 'path'
 */
function ParentView() {
    const [data, setData] = useState(0)
    const buttonClick = () => { setData (data + 1) }

    return(
        <div>
            <p>{data}</p>
            <button onClick= {buttonClick}>button</button>
            <TransferContext.Provider value={data}>
                <ChildView></ChildView>
            </TransferContext.Provider>
        </div>
    )
}

/**
 * ChildView & DescendantView
 *
 * import {useState, userContext} from 'react'
 * import {TransferContext} from 'path'
 */
function ChildView() {
    const data = useContext(TransferContext)
    return (
      <div>
        <p>{data}</p>
        <DescendantView></DescendantView>
      </div>

    )
}

function DescendantView() {
  const data = useContext(TransferContext)
  return(
    <p>{data}</p>
  )
}

export default ParentView

```

## hook - Reducer

```jsx
import React, {useState, useContext,useReducer} from "react"
/**
 * import React, {createContext} from 'path'
 */
export const TransferContext = React.createContext({})
export const ACTIONTYPE1 = "ACTIONTYPE1"
export const ACTIONTYPE2 = "ACTIONTYPE2"

export const reducer = (data, action) => {
    switch(action.type) {
        case ACTIONTYPE1:
            return data + 1
        case ACTIONTYPE2 :
            return data - 1
        default:
            return data
    }
}

/**
 * ContainView
 *
 * import React, {useReducer} from 'path'
 * import { TransferContext } from 'path'
 */
function ContainView() {
    let initalData = 0;
    const [data, dispatch] = useReducer(reducer,initalData)
    return (
        <TransferContext.Provider value={{data, dispatch}}>
            <ContainViewA></ContainViewA>
            <ContainViewB></ContainViewB>
        </TransferContext.Provider>
    )
}

/**
 * ContainViewA
 *
 * import { TransferContext } from 'path'
 *
 * export default ContainViewA
 */
function ContainViewA() {
    const {data} = useContext(TransferContext)
    return (
        <div>{data}</div>
    )
}

/**
 * ContainViewB
 *
 * import { TransferContext } from 'path'
 *
 * export default ContainViewB
 */
function ContainViewB() {
    const { dispatch } = useContext(TransferContext)
    return (
        <div>
            <button onClick={() => {dispatch({type: ACTIONTYPE1})}}>addButton</button>
            <button onClick={() => {dispatch({type: ACTIONTYPE2})}}>subButton</button>
        </div>
    )
}

export default ContainView

```

## hook - callback

```jsx
import React, { useState, useCallback} from "react";

function ParentView(props) {
  const [data, setData] = useState(0);

  const buttonClick = () => {
    setData( data + 1 )
  }

  const childViewClick3 = () => {}
  const childViewClick4 = useCallback(() => {},[])

  return (
    <div>
      <p>{data}</p>
      <button onClick={buttonClick}>click</button>

      <ChildView1></ChildView1>
      <ChildView2></ChildView2>
      <ChildView3 click = { childViewClick3 }></ChildView3>
      <ChildView4 click = { childViewClick4 }></ChildView4>
    </div>
  );
}

/**
 * childview1
 *
 * React默认父组件状态变化会引发子组件重新渲染;
 *
 * 不是吧老大,我的子组件不依赖于你父组件的状态,为什么还要来重新渲染我呢,思考React为什么要这么设计 ? ;
 * 期望当然是:如果我们子组件依赖父组件的数据,那可以重新渲染我,如果子组件不依赖父组件的数据,不应该来把我重新渲染一次浪费性能;
 */
function ChildView1(props) {
    console.log("this is childview1") // 重新渲染
    return (
      <div>
      </div>
    );
}

/**
 * childview2
 *
 * - React.memo周知React我是个纯组件(有固定输入就有固定输出),
 * - 除非我依赖父组件的数据props发生变化,否则你别来重新渲染我浪费性能
 * - 当然了这里不依赖父组件的数据,所以父组件渲染的时候,子组件不会再重新渲染;
 */
const ChildView2 = React.memo(ContainView2)
function ContainView2() {
    console.log("this is childView2")
    return (
      <div>
      </div>
    );
}

/**
 * childview3
 *
 * - 问题是假如子组件真的接收了源于父组件的数据,那么数据props变化才重新渲染;
 * - 父组件重新渲染后,childViewClick3也会被重新赋值,因此被认为props是改变所以重新渲染;
 * - 思考:父组件重新渲染每次childViewClick3都被重新赋值,从而触发子组件重新渲染有必要么;
 *       其实没有必要,因为childViewClick3k可能每次被重新赋值的是同一个,既然是同一个就没有必要触发子组件重新渲染;
 */
const ChildView3 = React.memo(ContainView3)
function ContainView3(props) {
    console.log("this is childView3")
    return (
      <div>
      </div>
    );
}

/**
 * childview4
 *
 * - React.memo告诉React我这是个纯组件(有固定输入就有固定输出)
 * - 除非我prop发生变化,否则你别来重新渲染我浪费性能
 * - 子组件是否重新渲染取决于useCallback所依赖具体状态[],
 * - 只有当依赖状态变化childViewClick4才会被重新赋值,进而重新渲染子组件;
 */
const ChildView4 = React.memo(ContainView4)
function ContainView4(props) {
    console.log("this is childView4")
    return (
      <div>
      </div>
    );
}

export default  ParentView

```

## hook - Memo

```jsx
import React, { useMemo, useState } from "react";

function ContainView(props) {

  const [data1, setData1] = useState(0);  // 原始类型
  const [data2, setData2] = useState(0);
  const [data3, setData3] = useState(0);

  const handleClick = (type) => {
    switch (type) {
        case 'click1':
            setData1(data1 + 1)
            break;
        case 'click2':
            setData2(data2 + 1)
            break;
        case 'click3':
            setData3(data3 + 1)
            break;
        default:
            break;
    }
  };

  // useMemo只能声明在函数式组件内部,且传入的函数内部需要有返回值
  const sum = useMemo(() => {
    console.log('useMemo')
    return data1 + data2
 },[data1, data2])

  return (
    <div>
      <p>{data1}</p>
      <p>{data2}</p>
      <p>{sum}</p>
      <button onClick={() => {handleClick('click1')}}>dataButton1</button>
      <button onClick={() => { handleClick('click2') }}>dataButton2</button>
      <p>{data3}</p>
      <button onClick={() => { handleClick('click3') }}>dataButton3</button>

    </div>
  );
}

export default ContainView;

```

## 第三方 - Redux

```jsx
(type & data)
+-----------+        action          +------------+      preState & action    +------------+
|           |    (type & data)       |            | ------------------------> |            |
|  Actions  | -------------------->  |    Store   |                           |  Reducers  |
|           |                        |            | <------------------------ |            |
+-----------+                        +------------+         newState          +------------+
      ^                                     |
      |                                     |
      |                                     | getState
      |                                     |
      |                                     v
      |                              +------------+
      |                              |            |
      |----------------------------- |    Views   |
                                     |            |
                                     +------------+

```
