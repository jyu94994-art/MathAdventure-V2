window.MathAdventureData = {
  worlds: [
    { id: 1, name: "森林王国", grade: "一年级", icon: "🌲", boss: "🐺", focus: "20以内加减法", color: "#2fac66" },
    { id: 2, name: "海洋世界", grade: "二年级", icon: "🌊", boss: "🦈", focus: "表内乘除法", color: "#2f88ff" },
    { id: 3, name: "沙漠探险", grade: "三年级", icon: "🏜️", boss: "🦂", focus: "多位数运算", color: "#ffb13d" },
    { id: 4, name: "冰雪王国", grade: "四年级", icon: "❄️", boss: "🐻‍❄️", focus: "混合运算", color: "#5fb9ff" },
    { id: 5, name: "天空之城", grade: "五年级", icon: "☁️", boss: "🦅", focus: "小数与几何", color: "#8a6cff" },
    { id: 6, name: "宇宙空间", grade: "六年级", icon: "🪐", boss: "👾", focus: "分数百分数", color: "#263144" }
  ],
  skills: [
    { id: "add", name: "加法" },
    { id: "sub", name: "减法" },
    { id: "mul", name: "乘法" },
    { id: "div", name: "除法" },
    { id: "word", name: "应用题" },
    { id: "geo", name: "几何" }
  ],
  shop: [
    { id: "hint", name: "提示卡", desc: "答题时排除两个错误答案", price: 20, type: "coin", icon: "💡" },
    { id: "revive", name: "复活卡", desc: "Boss 战中恢复 30 点 Boss 伤害机会", price: 35, type: "coin", icon: "❤️" },
    { id: "doubleXp", name: "双倍经验", desc: "接下来 5 题经验翻倍", price: 2, type: "diamond", icon: "⚡" },
    { id: "skin", name: "星光皮肤", desc: "获得限定称号：星光冒险家", price: 80, type: "coin", icon: "✨" }
  ],
  achievements: [
    { id: "firstAnswer", name: "首次答题", desc: "完成第一道题", coin: 10, diamond: 0 },
    { id: "combo5", name: "连击新星", desc: "达成 5 连击", coin: 30, diamond: 1 },
    { id: "answer20", name: "练习达人", desc: "累计答题 20 道", coin: 50, diamond: 1 },
    { id: "boss1", name: "森林勇者", desc: "击败森林王国 Boss", coin: 80, diamond: 2 },
    { id: "wrongClear", name: "错题清道夫", desc: "完成一次错题复练", coin: 40, diamond: 1 },
    { id: "petLv3", name: "宠物训练师", desc: "宠物升到 3 级", coin: 60, diamond: 1 }
  ]
};
