(function (root) {
  'use strict';

  const levels = [
    { id: 13, title: '进退之间', mechanic: 'dual_bridge', teaser: '相反的方向，也会在中间相遇。', hint: '两边的力量并不冲突。', creator: ['双键蓄力', '生成平台'] },
    { id: 14, title: '保持距离', mechanic: 'runaway_door', teaser: '它好像不太愿意见你。', hint: '有些东西，被看住才会老实。', creator: ['元素逃离', '按住冻结'] },
    { id: 15, title: '一笔成路', mechanic: 'ink_path', teaser: '空白处，也许并不是真的空。', hint: '空白并不一定无路。', creator: ['手势绘制', '生成平台'] },
    { id: 16, title: '风停之后', mechanic: 'silent_wait', teaser: '越靠近，声音越多。', hint: '答案可能在你什么也不做的时候出现。', creator: ['静止计时', '近距离触发'] },
    { id: 17, title: '方向借走了', mechanic: 'reverse_controls', teaser: '脚步没有错，方向却不认识你。', hint: '别相信按钮写着什么。', creator: ['反向控制'] },
    { id: 18, title: '日影无声', mechanic: 'shadow_sun', teaser: '门前少了一块安静的黑。', hint: '光的位置，会替地面说话。', creator: ['拖动天体', '投影开关'] },
    { id: 19, title: '路在字里', mechanic: 'word_bridge', teaser: '有些话，说出来不如放下来。', hint: '题目里也许有能踩的东西。', creator: ['拖动文字', '文字实体化'] },
    { id: 20, title: '守门人的礼仪', mechanic: 'knock_twice', teaser: '门没有锁，只是不认识你。', hint: '站近一点，再礼貌地打两次招呼。', creator: ['近距离点击', '次数条件'] },
    { id: 21, title: '花之暗号', mechanic: 'flower_password', teaser: '花开得快，也谢得快。', hint: '每块石头藏着一个会消失的数字。', creator: ['顶撞计数', '数字密码'] },
    { id: 22, title: '钥匙的影子', mechanic: 'shadow_key', teaser: '亮着的那把，未必是真的。', hint: '别只看会发光的部分。', creator: ['影子拾取', '真假道具'] },
    { id: 23, title: '别急着走', mechanic: 'passenger_platform', teaser: '路愿意载你，但不喜欢催促。', hint: '站稳之后，先松开方向。', creator: ['载人移动平台', '静止触发'] },
    { id: 24, title: '小一点', mechanic: 'shrink_tunnel', teaser: '门没有变窄，是你太认真了。', hint: '点一下自己，或许能少占一点地方。', creator: ['点击变形', '低矮通道'] },
    { id: 25, title: '云不肯落', mechanic: 'cloud_hold', teaser: '它看起来很轻，脾气却很沉。', hint: '别点一下就走，云需要被留住。', creator: ['长按元素', '升降平台'] },
    { id: 26, title: '两扇都像', mechanic: 'decoy_door', teaser: '最像出口的，通常最会骗人。', hint: '先碰一碰门上的记号。', creator: ['真假终点', '点击切换'] },
    { id: 27, title: '题目落地', mechanic: 'title_platform', teaser: '这句话站得太高了。', hint: '标题不一定只能用来读。', creator: ['拖动标题', '文字平台'] },
    { id: 28, title: '屏住一下', mechanic: 'freeze_spikes', teaser: '越着急，地面越不安分。', hint: '按住空白处，另一只手继续走。电脑可按住 Shift。', creator: ['按住冻结', '动态障碍'] },
    { id: 29, title: '第二口气', mechanic: 'double_jump', teaser: '一次离地，并不代表只能跳一次。', hint: '还在空中时，再按一次跳跃。', creator: ['多段跳'] },
    { id: 30, title: '别看它', mechanic: 'face_away', teaser: '门一被注视，就把自己关紧。', hint: '靠近之后，把脸转开一会儿。', creator: ['朝向检测', '持续条件'] },
    { id: 31, title: '终点太远', mechanic: 'drag_door', teaser: '如果路太长，也许不该走路。', hint: '终点并没有钉在地上。', creator: ['拖动终点'] },
    { id: 32, title: '无形之上', mechanic: 'invisible_bridge', teaser: '眼睛说没有，脚底还没回答。', hint: '照常往前，别替深渊做决定。', creator: ['隐形平台'] },
    { id: 33, title: '镜中方向', mechanic: 'mirror_world', teaser: '你在这里，影像却走向那里。', hint: '按键控制的是镜子外面的你。', creator: ['镜像渲染', '坐标映射'] },
    { id: 34, title: '抬脚成桥', mechanic: 'jump_bridge', teaser: '脚离开地面时，路反而出现。', hint: '让跳跃保持着，路才肯留下。', creator: ['持续按键', '临时平台'] },
    { id: 35, title: '同频的门', mechanic: 'door_jumps', teaser: '它学得太快，也不一定是坏事。', hint: '门跟着你跳；让它在空中时停一下。', creator: ['动作跟随', '空中点击'] },
    { id: 36, title: '地面换班', mechanic: 'ground_swap', teaser: '脚下的路，只肯一次出现一半。', hint: '点两岸的小草，会让安全的地方换边。', creator: ['点击地形', '平台切换'] },
    { id: 37, title: '胆小的钥匙', mechanic: 'flee_key', teaser: '你越追，它越像有急事。', hint: '看住它，比追上它更有效。', creator: ['道具逃离', '按住冻结'] },
    { id: 38, title: '箱子不只是箱子', mechanic: 'push_box', teaser: '高处没有梯子，地上倒有重量。', hint: '把箱子推到门下，再借它一步。', creator: ['可推动箱子', '垫脚平台'] },
    { id: 39, title: '月亮在脚下', mechanic: 'gravity_flip', teaser: '天空和地面，只差一次选择。', hint: '点一下月亮，重的方向就会改变。', creator: ['重力翻转', '点击天体'] },
    { id: 40, title: '三声之后', mechanic: 'sound_order', teaser: '三块石头，各有自己的声调。', hint: '从低到高，让它们依次开口。', creator: ['音高机关', '顺序条件'] },
    { id: 41, title: '墙也会忘', mechanic: 'erase_wall', teaser: '挡路的东西，看起来画得并不牢。', hint: '用手指从墙上来回擦过去。', creator: ['擦除手势', '可消除墙体'] },
    { id: 42, title: '先回到开始', mechanic: 'start_backward', teaser: '终点等你，但起点还没告别。', hint: '先往回走到最左边，再去见门。', creator: ['顺序区域', '折返条件'] }
  ];

  if (levels.length !== 30 || levels[0].id !== 13 || levels[levels.length - 1].id !== 42) {
    throw new Error('review level catalog must contain levels 13–42');
  }

  root.GuaiqiReviewLevels = Object.freeze(levels.map(function (level) {
    return Object.freeze(Object.assign({}, level, { creator: Object.freeze(level.creator.slice()) }));
  }));
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GuaiqiReviewLevels;
})(typeof window !== 'undefined' ? window : globalThis);
