## oyvim-normal

```text
i        |        a                     # insert before or append after current letter
I        |        A                     # insert before or append after current line
O        |        o                     # insert before or append after new line
p        |        u                     # paste or undo
----------------------------------------------------------------------------------------
h        |        l                     # move left or right
j        |        k                     # move down or up
b        |        w                     # move left or right to word prefix
ge       |        e                     # move left or right to word suffix
^        |        $                     # move head and tail of line
Fl       |       fl                     # move left right to 'l' letter in line
;        |        ,                     # move repeat to 'l' letter or reverse move repeat
H        |        M       |       L     # move cursor to high middle low in page
gg       |        G                     # move top bottom in file
zt       |        zz      |       zb    # scroll current row to top middle bottom
----------------------------------------------------------------------------------------
rl                                      # replace letter to 'l'
R                                       # turn to replace mode
----------------------------------------------------------------------------------------
x                                       # delete letter
5x                                      # delete 5 letter
----------------------------------------------------------------------------------------
c                                       # change operator
cb       |       c5b                    # change cursor to left 1 or 5 word end
cw       |       c5w                    # change cursor to right 1 or 5 word end
ciw      |       caw                    # change inner arround word
ci[      |       ca[                    # change inner arround content in []
ci{      |       ca{                    # change inner arround content in {}
cit      |       cat                    # change inner arround tag
c^       |       c$                     # change left | right
cFl      |       cfl                    # change cursor to 'l' target letter
cc       |       5cc      |      c5j    # change line or 5 line
c/hello                                 # change util hello
cie                                     # change entire file
----------------------------------------------------------------------------------------
d                                       # delete operator
db       |       d5b                    # delete cursor to left 1 or 5 word end
dw       |       d5w                    # delete cursor to right 1 or 5 word end
diw      |       daw                    # delete inner arround word
di[      |       da[                    # delete inner arround content in []
di{      |       da{                    # delete inner arround content in {}
dit      |       dat                    # delete inner arround tag
d^       |       d$                     # delete left | right
dFl      |       dfl                    # delete cursor to 'l' target letter
dd       |       5dd      |      d5j    # delete line or 5 line
d/hello                                 # delete util hello
die                                     # delete entire file
----------------------------------------------------------------------------------------
y                                       # yank operator
yb       |       y5b                    # yank cursor to left 1 or 5 word end
yw       |       y5w                    # yank cursor to right 1 or 5 word end
yiw      |       yaw                    # yank inner arround word
yi[      |       ya[                    # yank inner arround content in []
yi{      |       ya{                    # yank inner arround content in {}
yit      |       yat                    # yank inner arround tag
y^       |       y$                     # yank left | right
yFl      |       yfl                    # yank cursor to 'l' target letter
yy       |       5yy      |      y5j    # yank line or 5 line
y/hello                                 # yank util hello
yie                                     # yank entire file
----------------------------------------------------------------------------------------
control + d                             # 向下翻页
control + u                             # 向下翻页

```

## oyvim-visual

```text
v                                       # visual operator
vb       |       v5b                    # visual cursor to left 1 or 5 word end
vw       |       v5w                    # visual cursor to right 1 or 5 word end
viw      |       vaw                    # visual inner arround word
vi[      |       va[                    # visual inner arround content in []
vi{      |       va{                    # visual inner arround content in {}
vit      |       vat                    # visual inner arround tag
v^       |       v$                     # visual left | right
vFl      |       vfl                    # visual cursor to 'l' target letter
vv       |       5vv      |      v5j    # visual line or 5 line
V                                       # visual mode select line
v/hello                                 # visual util hello
control + v                             # select multiple cursor
vie                                     # visual entire file

```

## oyvim-easymotion

```text
/[str]                                  # search target str
n         |        N                    # search next last target str
<leader><leader> s[c]                   # search letter
----------------------------------------------------------------------------------------
gd                                      # jump to define
gh                                      # find funciton signature,cursor hover
gb                                      # select tag in html

```

## oyvim-command

```text
:set nu                                # show line numbers
:vs                                    # split horizontal screen
:sp                                    # split vertical screen,
:% s/[str1]/[str2]/g                   # replace str1 with str2 global
:[n1],[n2] s/[str1][str2]/g            # replace str1 with str2 between line n1 to n2
:syntax on                             # highlight the code

```

## oyvim-insert

```text
control + n/p                                 # complete words
control + x/f                                 # complete path name
control + x/o                                 # complete code

```

## oyvim-note

```text
# 凡是删除操作都会自动进行提前自动进行拷贝
# d和c的区别在于c会自动进入插入模式

```
