(function (root) {
  'use strict';

  const levels = [
    { id: 13, title: '进退之间', mechanic: 'dual_bridge', teaser: '相反的方向，也会在中间相遇。', hint: '同时按住左、右两个方向约1秒，等两侧道路在断崖中间合成桥。', creator: ['双键蓄力', '生成平台'] },
    { id: 14, title: '保持距离', mechanic: 'runaway_door', teaser: '它好像不太愿意见你。', hint: '人物靠近时门会逃跑：一根手指持续按住门，另一根手指控制人物走到门前。', creator: ['元素逃离', '按住冻结'] },
    { id: 15, title: '一笔成路', mechanic: 'ink_path', teaser: '空白处，也许并不是真的空。', hint: '从断崖左岸开始，用手指连续划到右岸再松开；痕迹连接两岸后可以踩上去。', creator: ['手势绘制', '生成平台'] },
    { id: 16, title: '风停之后', mechanic: 'silent_wait', teaser: '越靠近，声音越多。', hint: '先走到门旁，再松开方向和跳跃，原地不动约2秒，等门自己打开。', creator: ['静止计时', '近距离触发'] },
    { id: 17, title: '方向借走了', mechanic: 'reverse_controls', teaser: '脚步没有错，方向却不认识你。', hint: '这一关左右控制相反：按左会向右，按右会向左，反着操作走到门前。', creator: ['反向控制'] },
    { id: 18, title: '日影无声', mechanic: 'shadow_sun', teaser: '门前少了一块安静的黑。', hint: '拖动天空中的太阳，观察地面影子；把太阳移到画面上方偏中间的位置来开门。', creator: ['拖动天体', '投影开关'] },
    { id: 19, title: '路在字里', mechanic: 'word_bridge', teaser: '有些话，说出来不如放下来。', hint: '按住画面中的“路”字，把它拖进两岸之间的断崖底部；放好后文字会变成桥。', creator: ['拖动文字', '文字实体化'] },
    { id: 20, title: '守门人的礼仪', mechanic: 'knock_twice', teaser: '门没有锁，只是不认识你。', hint: '先把人物走到门旁，再连续点击门两次；距离太远时敲门有声音，但不会计数。', creator: ['近距离点击', '次数条件'] },
    { id: 21, title: '花之暗号', mechanic: 'flower_password', teaser: '花开得快，也谢得快。', hint: '依次跳起顶四个问号石块，数清每块出现过几朵花并记住；花全部消失后，到门前输入四位数量。', creator: ['顶撞计数', '数字密码'] },
    { id: 22, title: '钥匙的影子', mechanic: 'shadow_key', teaser: '亮着的那把，未必是真的。', hint: '不要碰悬在空中的亮钥匙，直接走过它正下方地面上的钥匙影子，再前往门口。', creator: ['影子拾取', '真假道具'] },
    { id: 23, title: '别急着走', mechanic: 'passenger_platform', teaser: '路愿意载你，但不喜欢催促。', hint: '跳到移动平台上后松开方向键，站稳不动让平台自动向右；到右岸后再继续前进。', creator: ['载人移动平台', '静止触发'] },
    { id: 24, title: '小一点', mechanic: 'shrink_tunnel', teaser: '门没有变窄，是你太认真了。', hint: '点击人物让身体缩小，再从低矮通道下面走过去；通过后直接前往门口。', creator: ['点击变形', '低矮通道'] },
    { id: 25, title: '云不肯落', mechanic: 'cloud_hold', teaser: '它看起来很轻，脾气却很沉。', hint: '持续按住云把它压到地面附近，跳到云上后松手，让上升的云把人物送到右侧高台。', creator: ['长按元素', '升降平台'] },
    { id: 26, title: '两扇都像', mechanic: 'decoy_door', teaser: '最像出口的，通常最会骗人。', hint: '先点击左边门上的叉号，使真正的出口生效；然后继续向右，走到另一扇门前。', creator: ['真假终点', '点击切换'] },
    { id: 27, title: '题目落地', mechanic: 'title_platform', teaser: '这句话站得太高了。', hint: '按住关卡标题“题目落地”，把整行标题拖到断崖中间偏下的位置，它会变成可踩的平台。', creator: ['拖动标题', '文字平台'] },
    { id: 28, title: '屏住一下', mechanic: 'freeze_spikes', teaser: '越着急，地面越不安分。', hint: '一根手指持续按住游戏画面的空白处冻结尖刺，另一根手指控制人物穿过；电脑可按住Shift。', creator: ['按住冻结', '动态障碍'] },
    { id: 29, title: '第二口气', mechanic: 'double_jump', teaser: '一次离地，并不代表只能跳一次。', hint: '第一次跳到半空后，再按一次跳跃完成二段跳，用第二次上升越过整段断崖。', creator: ['多段跳'] },
    { id: 30, title: '别看它', mechanic: 'face_away', teaser: '门一被注视，就把自己关紧。', hint: '走到门旁后停住，轻按左方向让人物背对门，再保持不动约1秒。', creator: ['朝向检测', '持续条件'] },
    { id: 31, title: '终点太远', mechanic: 'drag_door', teaser: '如果路太长，也许不该走路。', hint: '按住远处的门，把它向左拖到人物附近；门靠近后，再控制人物走进门里。', creator: ['拖动终点'] },
    { id: 32, title: '无形之上', mechanic: 'invisible_bridge', teaser: '眼睛说没有，脚底还没回答。', hint: '断崖中间有一座看不见的桥，不需要跳跃；保持向右走，人物会踩着空气通过。', creator: ['隐形平台'] },
    { id: 33, title: '镜中方向', mechanic: 'mirror_world', teaser: '你在这里，影像却走向那里。', hint: '画面显示的是镜像：按住右方向，即使看到人物向左移动，也要继续走到左侧显示的门前。', creator: ['镜像渲染', '坐标映射'] },
    { id: 34, title: '抬脚成桥', mechanic: 'jump_bridge', teaser: '脚离开地面时，路反而出现。', hint: '持续按住跳跃按钮不要松手，断崖上的桥才会保持出现；同时按方向键走过桥。', creator: ['持续按键', '临时平台'] },
    { id: 35, title: '同频的门', mechanic: 'door_jumps', teaser: '它学得太快，也不一定是坏事。', hint: '先让人物跳起，门也会跟着跳；趁门还在空中时点击门，把它停住并打开。', creator: ['动作跟随', '空中点击'] },
    { id: 36, title: '地面换班', mechanic: 'ground_swap', teaser: '脚下的路，只肯一次出现一半。', hint: '先走上左半段道路，到两段道路能衔接的位置后，点击右岸的小草切换成右半段，再继续向门走。', creator: ['点击地形', '平台切换'] },
    { id: 37, title: '胆小的钥匙', mechanic: 'flee_key', teaser: '你越追，它越像有急事。', hint: '一根手指持续按住钥匙让它停止逃跑，另一根手指控制人物走到钥匙上，再去开门。', creator: ['道具逃离', '按住冻结'] },
    { id: 38, title: '箱子不只是箱子', mechanic: 'push_box', teaser: '高处没有梯子，地上倒有重量。', hint: '从箱子左侧贴住它并向右走，把箱子推到右侧高台下；再跳上箱子，借它登上门前高台。', creator: ['可推动箱子', '垫脚平台'] },
    { id: 39, title: '月亮在脚下', mechanic: 'gravity_flip', teaser: '天空和地面，只差一次选择。', hint: '点击右上方的月亮翻转重力，等人物落到天花板后，再向右走进倒挂的门。', creator: ['重力翻转', '点击天体'] },
    { id: 40, title: '三声之后', mechanic: 'sound_order', teaser: '三块石头，各有自己的声调。', hint: '先分别点击三块石头试听并记住音高，再按“最低音→中间音→最高音”的顺序各点一次。', creator: ['音高机关', '顺序条件'] },
    { id: 41, title: '墙也会忘', mechanic: 'erase_wall', teaser: '挡路的东西，看起来画得并不牢。', hint: '在中间高墙上按住手指并来回滑动，多擦几次直到墙完全消失，再向右走。', creator: ['擦除手势', '可消除墙体'] },
    { id: 42, title: '先回到开始', mechanic: 'start_backward', teaser: '终点等你，但起点还没告别。', hint: '开局先一直向左，走进最左边地面的圆形起点；圆圈变色后，再折返向右进入门。', creator: ['顺序区域', '折返条件'] }
  ];

  if (levels.length !== 30 || levels[0].id !== 13 || levels[levels.length - 1].id !== 42) {
    throw new Error('review level catalog must contain levels 13–42');
  }

  root.GuaiqiReviewLevels = Object.freeze(levels.map(function (level) {
    return Object.freeze(Object.assign({}, level, { creator: Object.freeze(level.creator.slice()) }));
  }));
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GuaiqiReviewLevels;
})(typeof window !== 'undefined' ? window : globalThis);
