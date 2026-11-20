## 数据库 - MYSQL

```sql
# 启动mysql
mysql.server start
# 登录mysql
mysql -uroot -p
# 查看mysql版本
select version();
# 查看数据库存储路径
SHOW VARIABLES LIKE 'datadir';
# 退出mysql
exit

```

## 数据库 - 基础

```sql
# 展示所有数据库
SHOW DATABASES;
# 创建数据库(指定字符集和校对规则)
CREATE DATABASE IF EXISTS $database CHARACTER SET utf8 COLLATE utf8_general_ci;
# 删除数据库
DROP DATABASE IF EXISTS $database;
# 查看某个数据库
SHOW CREATE DATABASE $database
# 选中数据库
USE $database;
# 查看当前所处数据库
SELECT DATABASE();
# 备份数据库
mysqldump -u $username -p -B $database1 $database2 > $filename.sql
# 导入数据库
Source $filename.sql
# 某条命令输入一半取消掉该命令
\c

```

## 数据类型

```sql
+-------------------+--------------------+-------------------+
|      TINYINT      |       1 byte       |                   |
+----------------------------------------|                   |
|      SMALLINT     |       2 byte       |                   |
+----------------------------------------|                   |
|     MEDIUMINT     |       3 byte       |        整型        |
+----------------------------------------| (UNSIGNED/SIGNED) |
|        INT        |       4 byte       |                   |
+----------------------------------------|                   |
|       BIGINT      |       8 byte       |                   |
+----------------------------------------+-------------------+
|       FLOAT       |       4 byte       |                   |
+----------------------------------------|                   |
|       DOUBLE      |       8 byte       |       浮点型       |
+----------------------------------------|                   |
|    DECTMAL(M,N)   |   M总位数 N小数位数  |                   |
+------------------------------------------------------------+
|      CHAR(Max)    |    255 character   |     定长字符串      |
+------------------------------------------------------------+
|     VARCHAR(Max)  |     65532 byte     |     变长字符长      |
+------------------------------------------------------------+
|      TINYTEXT     |                    |                   |
+----------------------------------------|                   |
|     MEDIUMTEXT    |                    |                   |
+----------------------------------------|       文本         |
|      LONGTEXT     |                    |                   |
+----------------------------------------|                   |
|        TEXT       |                    |                   |
+------------------------------------------------------------+
|      TINYBLOB     |                    |                   |
+----------------------------------------|       二进制       |
|       BLOB        |                    |                   |
+-------------------+--------------------|-------------------+
|       DATE        |                    |                   |
+----------------------------------------|                   |
|       TIME        |                    |                   |
+----------------------------------------|                   |
|       YEAR        |                    |       日期         |
+----------------------------------------|                   |
|      DATEIME      |                    |                   |
+----------------------------------------|                   |
|     TIMESTAMP     |                    |                   |
+------------------------------------------------------------+

```

## 表 - 基础

```sql
# 建立表(关键字用``命名起来)
CREATE TABLE `$table`(
   `$field1` $INT PRIMARY KEY,
   `$field2` VARCHAR($max) NOT NULL,
   `$field3` VARCHAR($max) DEFAULT NULL
   `$field4` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPGATE CURRENT_TIMESTAMP
) CHARACTER SET utf8 COLLATE utf8_general_ci ENGINE INNODB;
# 删除表
DROP TABLE IF EXISTS $table;
# 删除表并重新创建该表
TRUNCATE TABLE $table;
# 展示所有表
SHOW TABLES;
# 选择数据表
USE $table;
# 显示数据表的结构
DESC $table;
# 查询指定表的建表语句
SHOW CREATE TABLE $table;

# 修改表名
RENAME TABLE $old_table TO $new_table
ALTER TABLE $old_table RENAME $new_table
# 表添加字段
ALTER TABLE $table ADD $filed1 $type AFTER $field NOT NULL DEFAULT $default
# 修改某个字段数据类型
ALTER TABLE $table MODIFY $field $new_type
# 修改表某个字段名称
ALTER TABLE $table CHANGE $old_field $new_field $new_type NOT NULL DEFAULT $default
# 删除表某个字段名
ALTER TABLE $table DROP $field
# 备份数据表
mysqldump -u $username -p $database $table1 $table2 > $path_file.sql
# 恢复数据表
Source $filename.sql

```

## 插入 - 基础

```sql
# 字符和日期型数据插入时值应使用单引号
INSERT INTO `$table` (field1, filed2, filed3) VALUES($value1, $value2, $value3)
# 所有字段插入数据可以省略字段名称
INSERT INTO `$table` VALUES($value1, $value2, $value3)

```

## 更新 - 基础

```sql
# 更新指定行的字段数据
UPDATE $table SET $field1 = $value1, $field2 = $value2 WHERE $condition

```

## 删除 - 基础

```sql
# 删除表指定行
DELETE FROM $table WHERE $field = $value
# 删除表所有行
DELETE FROM $table

```

## 查询 - 基础

```sql
# 查询全表数据
SELECT * FROM $table;
# 查询指定列数据(移除完全重复相同行)
SELECT DISTINCT $field1,$field2 FROM $table;
# 查询指定列数据(移除完全重复相同行)
SELECT DISTINCT $field1 $field2 FROM $table
# 查询表字段及对应数据(原表列名不变并且as可以省略)
SELECT $field aliasfield FROM TABLE;
SELECT $field AS aliasfield FROM TABLE;
# 查询表字段及对应数据(字段互相之间可以参与数学表达式)
SELECT ($field1 + field2 + filed3) AS aliasfield FROM TABLE;

```

## 查询 - 条件

```sql
# 条件查询(=/>/>=/</<=/<>/!=/between and)
SELECT $field1,$filed2 FROM $table WHERE $field = $value;
# 条件查询(IS NULL/IS NOT NULL)
SELECT $field1,$filed2 FROM $table WHERE $field_condition IS NULL;
# 条件查询(AND/OR,AND优先级比OR高,因此可以通过括号方式明确指定)
SELECT $field1,$filed2 FROM $table WHERE $condition AND $condition;
# 条件查询(IN/NOT IN,表示其中之一即命中/不命中)
SELECT $field1,$filed2 FROM $table WHERE $field in (1000000,2000000);
# 模糊查询(%表示匹配任意多个字符,_表示任意一个字符)
SELECT $field1,$filed2 FROM $table WHERE $field LIKE '__tony%';

```

## 查询 - 函数

```sql
# 统计满足条件的总行数
SELECT COUNT(*) FROM $table WHERE $condition
# 统计满足条件的总行数(排除field为null)
SELECT COUNT($field) FROM $table WHERE $condition
# 统计满足条件行数对应字段总和
SELECT SUM($field) FROM $table WHERE $condition
# 统计满足条件行数对应字段平均数
SELECT AVG($field) FROM $table WHERE $condition
# 统计满足条件行数对应字段最大数和最小数
SELECT MAX($field) MIN($field) FROM $table WHERE $condition

```

## 查询 - 分组

```sql
# 按照field分组从而分析各组的特性
SELECT $FUNC($field1), $FUNC($field2) $field FROM $table GROUP BY $field
# 按照多个field分组从而分析各组的特性
SELECT $FUNC($field1), $FUNC($field2) $field FROM $table GROUP BY $field, $field
# 通过字段进行分组后再进一步通过HAVING过滤
SELECT $FUNC($filed1), $FUNC($filed2) FROM $table GROUP BY $field HAVING $condition

```

## 查询 - 排序

```sql
# 排序查询(esc降序/asc升序)
SELECT $field1,$field2 from table $ORDER BY field DESC;
SELECT $filed1,$filed2 from table $ORDER BY $field1 ASC $field2 DESC;

```
