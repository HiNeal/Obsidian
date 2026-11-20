## vue - 基础使用

```vue
const app = Vue.createApp({
    data() {
        return {
            $message: '$message'
        }
    },
    methods: {
        handleItemClick() {
            this.$message = this.$message == ''
        }
    },
})
const vm = app.mount("#app")

```

## vue - 生命周期

```vue
beforeCreate() {
    console.log('实例生成之前执行')
},
created() {
    console.log('实例生成之后执行')
},
beforeMount() {
    console.log('模板渲染完成之前执行')
},
mounted() {
    console.log('模板渲染完成之后执行')
},
beforeUpdate() {
    console.log('数据变化立即执行执行')
},
updated() {
    console.log('数据变化渲染完成执行')
},
beforeUnmount() {
    console.log('应用失效时执行')
},
unmounted() {
    console.log('DOM完全销毁后执行')
},

```

## page

```vue
<script>
export default {
  data() {
    return {
      // reactive data
      msg: "hello world",
    };
  },
  computed: {
    // compute data (only called when depend data change)
    computeAttr() {},
  },
  methods: {
    // action method
    buttonClick() {
      alert("button is called ");
    },
  },
  components: {
    // register components
  },
};
</script>

<template>
  <!-- reactive data  -->
  <div>{{ msg }}</div>
  <!-- compute data  -->
  <div>{{ computeAttr }}</div>
  <!-- action method-->
  <button @click="buttonClick">click</button>
</template>

```

## page - Setup

```vue
<script setup>
import { reactive } from "vue";

// normal data
const msg = "hello world";
// reactive data
const obj = reactive({
  name: "",
  age: 18,
});
// action method
function buttonClick() {
  obj.age++;
}
</script>

<template>
  <div>{{ msg }}</div>
  <div>{{ obj.name }}</div>
  <button @click="buttonClick"></button>
</template>

```
