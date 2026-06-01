# 📚 超星课表导出工具

从超星泛雅平台课表页面提取课程数据，导出为 Excel / CSV。

## 工具列表

| 工具 | 说明 |
|------|------|
| `generate_schedule.py` | Python 脚本 — 将已有的 HTML 课表导出为 Excel（.xlsx） |
| `chaoxing_schedule_exporter.user.js` | 油猴脚本 — 在浏览器中直接提取所有周次的课表数据 |

---

## 🐍 Python 脚本用法

将超星课表页面（`schedule.html`）保存到本地，运行脚本即可生成 Excel。

```bash
python generate_schedule.py
```

生成的 Excel 包含 3 个工作表：
- **课表视图** — 视觉周课表，按星期×节次排列
- **课程明细表** — 逐条课程明细（含周次、时间、地点）
- **课程汇总** — 按课程名称分组

### 自定义周次

在脚本中修改 `total_weeks` 变量可调整导出周数：

```python
total_weeks = 14   # 导出第1-14周
```

如需为特定课程设置单周/双周或指定周次，修改 `week_config` 字典：

```python
week_config = {
    (5, 5, "体育Ⅳ"): "1-16",  # 体育课只上1-16周
}
```

---

## 🐵 油猴脚本用法

### 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 插件
2. 打开油猴管理面板 → **添加新脚本**
3. 复制 `chaoxing_schedule_exporter.user.js` 全部内容 → 粘贴 → 保存（Ctrl+S）

### 使用

1. 登录 [超星泛雅](https://kb.chaoxing.com/) 并打开课表页面
2. 页面右上角出现 **「📥 导出全部课表」** 按钮
3. 拖拽 **左侧六点手柄** 可移动按钮位置
4. 点击 **文字区域** 开始导出
5. 脚本自动遍历所有周次，提取每门课的真实上课周次
6. 导出完成后自动下载 CSV 文件

### 脚本特性

- ✅ **真实周次** — 从内存读取每门课的 `weeks` 属性（单周/双周/指定周次）
- ✅ **自动遍历** — 1 周到 25 周自动切换、提取、去重
- ✅ **可拖拽** — 按钮和状态面板均可拖拽移动
- ✅ **导出格式** — CSV（默认）/ JSON 均可切换
- ✅ **额外信息** — 同时提取上课教师、班级等信息

---

## 📁 文件说明

```
D:\xuexit\
├── 吉林农业科技学院智慧学工.html      # 超星课表页面（静态保存）
├── 吉林农业科技学院智慧学工_files/     # 页面资源文件
├── generate_schedule.py               # Python 导出脚本
├── generate_full_schedule.py          # Python 全学期导出脚本
├── chaoxing_schedule_exporter.user.js # 油猴脚本
├── 我的课表.xlsx                       # 第14周课表（示例输出）
├── 我的课表_全学期.xlsx                # 第1-14周课表（示例输出）
└── README.md                          # 本说明文件
```

---

## 📝 注意事项

- 静态 HTML 只保存了当前查看的周次（如第14周），其他周数据需从服务器动态加载
- Python 脚本默认按"每周相同模式"生成课表，如需精确周次请使用油猴脚本
- CSV 文件用 Excel 打开时，建议使用 **数据 → 自文本/CSV**，编码选 UTF-8

---

## 📄 许可证

MIT
