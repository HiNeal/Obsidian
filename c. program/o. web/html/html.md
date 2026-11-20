## hTML - Script

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <script>
      // for javascript
    </script>
  </body>
</html>

```

## hTML - Vue

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <!-- 引入Vue -->
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  </head>
  <body>
    <div id="app"></div>

    <script>
      // 整体逻辑: 组件 -> 组件生成组件实例 -> 虚拟DOM -> DOM

      // 编写组件
      const Root = {
        // data方法返回的对象中的属性会自动添加到组件实例中
        data() {
          return {
            count: 0,
          };
        },
        // 在模板中可以直接访问组件实例中的属性
        template:
          "<button @click='count + 1'> click </button> - {{count}} times",
      };

      // 根据组件创建组件实例(vm)
      const app = Vue.createApp(Root);
      // 挂载实例
      app.mount("#app");
    </script>
  </body>
</html>

```
