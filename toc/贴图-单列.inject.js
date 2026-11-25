(() => {
  const groups = [
  {
    "category": "R语言基础",
    "items": [
      {
        "title": "数据清洗",
        "href": "https://mp.weixin.qq.com/s/xg9hfI6p4Zv_L_icswH2RQ",
        "itemShowType": "8"
      },
      {
        "title": "宽表与长表",
        "href": "https://mp.weixin.qq.com/s/gD_vgCsX9GXQeyz99-8P1Q",
        "itemShowType": "8"
      },
      {
        "title": "批量读Excel",
        "href": "https://mp.weixin.qq.com/s/QzDDrspghySs5efCzqR8vQ",
        "itemShowType": "8"
      },
      {
        "title": "缺失值",
        "href": "https://mp.weixin.qq.com/s/y6tS5A2_IewwYV5yOQL-jQ",
        "itemShowType": "8"
      },
      {
        "title": "字符串处理",
        "href": "https://mp.weixin.qq.com/s/4PLONFJTr_38UGBFvpTj-A",
        "itemShowType": "8"
      }
    ]
  },
  {
    "category": "R代码管理",
    "items": [
      {
        "title": "临时存数据",
        "href": "https://mp.weixin.qq.com/s/PpLX4zY9LRURf8j8ll_fng",
        "itemShowType": "8"
      }
    ]
  },
  {
    "category": "流行病学",
    "items": [
      {
        "title": "因果科普书",
        "href": "https://mp.weixin.qq.com/s/4DYfhPm5ho4AkwUTWHywPg",
        "itemShowType": "8"
      }
    ]
  },
  {
    "category": "R语言作图",
    "items": [
      {
        "title": "AI复刻R图表",
        "href": "https://mp.weixin.qq.com/s/jDNZUnfO1pdGBJLOhTEK7g",
        "itemShowType": "8"
      }
    ]
  },
  {
    "category": "Shiny应用",
    "items": [
      {
        "title": "Shiny开发",
        "href": "https://mp.weixin.qq.com/s/5RysY-OQIp0-I6k6du-h4A",
        "itemShowType": "8"
      }
    ]
  }
];

  const guide = document.querySelector('#guide_words_main');
  if (!guide) throw new Error('未找到 #guide_words_main（请确认在贴图编辑页）');
  const pm = document.querySelector('.share-text__input .ProseMirror');
  if (pm) pm.style.lineHeight = '1.35';

  const vue = guide.__vue__;
  if (!vue || !vue.$children || !vue.$children[0] || !vue.$children[0].getView) {
    throw new Error('guide_words Vue/ProseMirror 未就绪');
  }
  const view = vue.$children[0].getView();
  const { schema } = view.state;
  const br = () => schema.nodes.hardbreak.create();
  const uid = () => 'id' + Math.random().toString(36).slice(2, 10);
  const linkText = (it) =>
    schema.text(it.title, [
      schema.marks.link.create({
        href: it.href,
        itemShowType: String(it.itemShowType),
        uniqueId: uid(),
      }),
    ]);

  const nodes = [];
  groups.forEach((g, gi) => {
    if (gi) nodes.push(br(), br());
    nodes.push(schema.text(g.category));
    (g.items || []).forEach((it) => {
      nodes.push(br(), linkText(it));
    });
  });
  nodes.push(br());

  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nodes));
  const content = vue.getContent ? vue.getContent() : null;
  console.log('贴图引导语已写入', { groups: groups.length, content });
  return content;
})();
