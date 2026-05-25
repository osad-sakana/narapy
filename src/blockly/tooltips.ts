import { Events } from 'blockly'
import type { WorkspaceSvg, Block } from 'blockly'

interface TooltipData {
  title: string
  description: string
  example: string
  output: string
}

const BLOCK_TOOLTIPS: Partial<Record<string, TooltipData>> = {
  // ── 入出力 ────────────────────────────────────────────
  text_print: {
    title: 'print(値, ...)',
    description: '値をコンソールに出力します。複数の値をカンマで渡すとスペース区切りで出力されます。',
    example: 'print("Hello, World!")\nprint("x =", 42)\nprint(True, None)',
    output: 'Hello, World!\nx = 42\nTrue None',
  },
  text_prompt_ext: {
    title: 'input(メッセージ)',
    description: 'ユーザーからキーボード入力を受け取ります。戻り値は常に文字列です。',
    example: 'name = input("名前を入力: ")\nprint("こんにちは、" + name)',
    output: '名前を入力: 太郎\nこんにちは、太郎',
  },

  // ── 数値・演算 ────────────────────────────────────────
  math_number: {
    title: '数値',
    description: '整数または小数の数値を表します。',
    example: 'x = 42\ny = 3.14\nprint(x, y)',
    output: '42 3.14',
  },
  math_arithmetic: {
    title: '算術演算 (+, -, *, /, **)',
    description: '四則演算と累乗を行います。/ は常に小数を返します。整数除算は // を使います。',
    example: 'print(10 + 3)\nprint(10 / 3)\nprint(10 // 3)\nprint(2 ** 8)',
    output: '13\n3.3333333333333335\n3\n256',
  },
  math_single: {
    title: '数学関数',
    description: '平方根・絶対値などの数学関数を適用します。',
    example: 'import math\nprint(abs(-7))\nprint(math.sqrt(25))',
    output: '7\n5.0',
  },
  math_round: {
    title: '丸め処理',
    description: 'round(): 四捨五入、ceil(): 切り上げ、floor(): 切り捨て。',
    example: 'import math\nprint(round(3.7))\nprint(math.ceil(3.2))\nprint(math.floor(3.9))',
    output: '4\n4\n3',
  },
  math_modulo: {
    title: 'a % b（余り）',
    description: 'a を b で割った余り（剰余）を返します。',
    example: 'print(10 % 3)\nprint(7 % 2)',
    output: '1\n1',
  },
  math_random_int: {
    title: 'random.randint(最小, 最大)',
    description: '指定した範囲の整数をランダムに1つ返します（両端を含む）。',
    example: 'import random\nprint(random.randint(1, 6))\nprint(random.randint(1, 6))',
    output: '4\n1',
  },
  math_number_property: {
    title: '数値の性質チェック',
    description: '数値が偶数・奇数・素数・正・負などかどうかを True/False で返します。',
    example: 'print(4 % 2 == 0)\nprint(7 % 2 != 0)',
    output: 'True\nTrue',
  },

  // ── 文字列 ────────────────────────────────────────────
  text: {
    title: '"文字列"',
    description: '文字列（テキスト）の値を表します。シングルまたはダブルクォートで囲みます。',
    example: 'msg = "こんにちは"\nprint(msg)\nprint(len(msg))',
    output: 'こんにちは\n5',
  },
  text_join: {
    title: '文字列の連結',
    description: '複数の値を連結して1つの文字列を作ります。',
    example: 'name = "太郎"\nprint("こんにちは、" + name + "！")',
    output: 'こんにちは、太郎！',
  },
  text_length: {
    title: 'len(文字列)',
    description: '文字列の文字数を返します。',
    example: 'print(len("Python"))\nprint(len("こんにちは"))',
    output: '6\n5',
  },
  text_indexOf: {
    title: 'str.find(検索文字列)',
    description: '指定した文字列が最初に出現する位置を返します（0始まり）。見つからない場合は -1。',
    example: 'text = "Hello, World!"\nprint(text.find("World"))\nprint(text.find("xyz"))',
    output: '7\n-1',
  },
  text_charAt: {
    title: '文字の取得 str[i]',
    description: '指定した位置の1文字を取得します（0始まり）。負の値は末尾から数えます。',
    example: 'text = "Python"\nprint(text[0])\nprint(text[-1])',
    output: 'P\nn',
  },
  text_getSubstring: {
    title: 'str[開始:終了]（スライス）',
    description: '文字列の一部を取得します。終了インデックスの文字は含みません。',
    example: 'text = "Hello, World!"\nprint(text[0:5])\nprint(text[7:])',
    output: 'Hello\nWorld!',
  },
  text_changeCase: {
    title: '大文字/小文字変換',
    description: 'upper(): 大文字、lower(): 小文字、title(): 単語先頭を大文字に変換します。',
    example: 'text = "hello world"\nprint(text.upper())\nprint(text.title())',
    output: 'HELLO WORLD\nHello World',
  },
  text_trim: {
    title: 'str.strip()',
    description: '文字列の先頭・末尾の空白を取り除きます。lstrip()/rstrip() は片側だけ。',
    example: 'text = "  Hello  "\nprint(text.strip())\nprint(text.lstrip())',
    output: 'Hello\nHello  ',
  },
  text_replace: {
    title: 'str.replace(旧, 新)',
    description: '文字列中の指定した部分を別の文字列に置き換えます。',
    example: 'text = "Hello, World!"\nprint(text.replace("World", "Python"))',
    output: 'Hello, Python!',
  },
  text_count: {
    title: 'str.count(文字列)',
    description: '文字列中に指定した文字列が何回出現するかを返します。',
    example: 'text = "banana"\nprint(text.count("a"))\nprint(text.count("na"))',
    output: '3\n2',
  },
  text_reverse: {
    title: 'str[::-1]（逆順）',
    description: '文字列を逆順にします。',
    example: 'text = "Python"\nprint(text[::-1])',
    output: 'nohtyP',
  },

  // ── 比較・論理 ────────────────────────────────────────
  logic_boolean: {
    title: 'True / False',
    description: '真偽値（ブール値）を表します。条件判定の結果として使われます。',
    example: 'print(True)\nprint(False)\nprint(1 == 1)',
    output: 'True\nFalse\nTrue',
  },
  logic_compare: {
    title: '比較演算子',
    description: '2つの値を比較して True/False を返します。\n== 等しい  != 等しくない\n<  より小  <= 以下  >  より大  >= 以上',
    example: 'print(5 == 5)\nprint(3 != 4)\nprint(10 >= 10)',
    output: 'True\nTrue\nTrue',
  },
  logic_operation: {
    title: 'and / or',
    description: 'and: 両方 True のとき True を返します。\nor:  どちらか True のとき True を返します。',
    example: 'print(True and False)\nprint(True or False)\nprint(3 > 1 and 5 < 10)',
    output: 'False\nTrue\nTrue',
  },
  logic_negate: {
    title: 'not',
    description: '真偽値を反転します。True → False、False → True。',
    example: 'print(not True)\nprint(not False)\nprint(not (3 > 5))',
    output: 'False\nTrue\nTrue',
  },

  // ── リスト ────────────────────────────────────────────
  lists_create_with: {
    title: '[要素, ...]（リスト作成）',
    description: '複数の要素をまとめたリストを作成します。異なる型を混在させることもできます。',
    example: 'nums = [1, 2, 3]\nprint(nums)\nprint(nums[0])',
    output: '[1, 2, 3]\n1',
  },
  lists_create_empty: {
    title: '[]（空のリスト）',
    description: '要素が何もない空のリストを作成します。後から append() で追加できます。',
    example: 'items = []\nitems.append("りんご")\nitems.append("バナナ")\nprint(items)',
    output: "['りんご', 'バナナ']",
  },
  lists_length: {
    title: 'len(リスト)',
    description: 'リストの要素数を返します。',
    example: 'fruits = ["りんご", "バナナ", "みかん"]\nprint(len(fruits))',
    output: '3',
  },
  lists_isEmpty: {
    title: 'リストが空かどうか',
    description: 'リストに要素がない（空）かどうかを True/False で返します。',
    example: 'a = []\nb = [1, 2]\nprint(len(a) == 0)\nprint(len(b) == 0)',
    output: 'True\nFalse',
  },
  lists_getIndex: {
    title: 'リスト[i]（要素の取得）',
    description: '指定した位置の要素を取得・削除します。負の値は末尾から数えます。',
    example: 'fruits = ["りんご", "バナナ", "みかん"]\nprint(fruits[0])\nprint(fruits[-1])',
    output: 'りんご\nみかん',
  },
  lists_setIndex: {
    title: 'リスト[i] = 値（要素の変更）',
    description: '指定した位置の要素を変更、または insert() で挿入します。',
    example: 'nums = [1, 2, 3]\nnums[1] = 99\nprint(nums)',
    output: '[1, 99, 3]',
  },
  lists_indexOf: {
    title: 'list.index(値)',
    description: '指定した値が最初に出現する位置を返します（0始まり）。',
    example: 'fruits = ["りんご", "バナナ", "みかん"]\nprint(fruits.index("バナナ"))',
    output: '1',
  },
  lists_getSublist: {
    title: 'リスト[開始:終了]（スライス）',
    description: 'リストの一部を新しいリストとして取得します。終了インデックスは含みません。',
    example: 'nums = [0, 1, 2, 3, 4]\nprint(nums[1:4])\nprint(nums[:3])',
    output: '[1, 2, 3]\n[0, 1, 2]',
  },
  lists_sort: {
    title: 'sorted(リスト)',
    description: 'リストを昇順または降順に並べ替えます。元のリストは変更しません。',
    example: 'nums = [3, 1, 4, 1, 5]\nprint(sorted(nums))\nprint(sorted(nums, reverse=True))',
    output: '[1, 1, 3, 4, 5]\n[5, 4, 3, 1, 1]',
  },
  lists_reverse: {
    title: 'リスト[::-1]（逆順）',
    description: 'リストの要素を逆順にした新しいリストを返します。',
    example: 'nums = [1, 2, 3, 4, 5]\nprint(nums[::-1])',
    output: '[5, 4, 3, 2, 1]',
  },
  lists_split: {
    title: 'str.split() / str.join()',
    description: 'split(): 文字列を区切り文字でリストに分割します。\njoin(): リストを文字列に結合します。',
    example: 'words = "a,b,c".split(",")\nprint(words)\nprint("-".join(words))',
    output: "['a', 'b', 'c']\na-b-c",
  },

  // ── for ループ ────────────────────────────────────────
  controls_for: {
    title: 'for 変数 in range(開始, 終了, ステップ):',
    description: '指定した範囲の数値を順番に処理します。終了値は含みません。',
    example: 'for i in range(0, 6, 2):\n    print(i)',
    output: '0\n2\n4',
  },
  controls_forEach: {
    title: 'for 変数 in リスト:',
    description: 'リストや文字列の各要素を順番に処理します。',
    example: 'fruits = ["りんご", "バナナ", "みかん"]\nfor f in fruits:\n    print(f)',
    output: 'りんご\nバナナ\nみかん',
  },
  controls_repeat_ext: {
    title: 'for _ in range(回数):',
    description: '指定した回数だけ同じ処理を繰り返します。',
    example: 'for _ in range(3):\n    print("Hello!")',
    output: 'Hello!\nHello!\nHello!',
  },
  controls_flow_statements: {
    title: 'break / continue',
    description: 'break: ループを途中で終了します。\ncontinue: 現在の回をスキップして次へ進みます。',
    example: 'for i in range(5):\n    if i == 3:\n        break\n    print(i)',
    output: '0\n1\n2',
  },

  // ── while ループ ─────────────────────────────────────
  controls_whileUntil: {
    title: 'while 条件:',
    description: '条件が True の間、処理を繰り返します。必ず条件が False になるように変数を更新してください。',
    example: 'n = 1\nwhile n <= 4:\n    print(n)\n    n += 1',
    output: '1\n2\n3\n4',
  },

  // ── 条件分岐 ─────────────────────────────────────────
  controls_if: {
    title: 'if / elif / else',
    description: '条件に応じて処理を分岐します。elif と else は省略可能です。',
    example: 'x = 75\nif x >= 80:\n    print("A")\nelif x >= 60:\n    print("B")\nelse:\n    print("C")',
    output: 'B',
  },
}

let enabled = true
let tooltipEl: HTMLDivElement | null = null

export function setTooltipsEnabled(value: boolean): void {
  enabled = value
  if (!value && tooltipEl) tooltipEl.style.display = 'none'
}

export function isTooltipsEnabled(): boolean {
  return enabled
}

// .blocklyFlyout の祖先を持つ要素のみ対象（ワークスペースブロックを除外）
function getBlockFromFlyout(el: Element, workspace: WorkspaceSvg): Block | null {
  if (!el.closest('.blocklyFlyout')) return null
  const blockEl = el.closest('[data-id]')
  if (!blockEl) return null
  const id = blockEl.getAttribute('data-id')
  if (!id) return null
  return workspace.getFlyout()?.getWorkspace().getBlockById(id) ?? null
}

function renderTooltip(el: HTMLElement, data: TooltipData): void {
  el.innerHTML = `
    <div class="bt-title"></div>
    <p class="bt-desc"></p>
    <div class="bt-section">
      <div class="bt-section-label">例</div>
      <pre class="bt-code"></pre>
    </div>
    <div class="bt-section bt-section-out">
      <div class="bt-section-label">▸ 出力</div>
      <pre class="bt-out"></pre>
    </div>
  `
  el.querySelector('.bt-title')!.textContent = data.title
  el.querySelector('.bt-desc')!.textContent = data.description
  el.querySelector('.bt-code')!.textContent = data.example
  el.querySelector('.bt-out')!.textContent = data.output
}

function positionTooltip(el: HTMLElement, pos: { clientX: number; clientY: number }): void {
  const OFFSET = 18
  el.style.visibility = 'hidden'
  el.style.display = 'block'
  void el.offsetHeight // force reflow
  const { width, height } = el.getBoundingClientRect()

  let x = pos.clientX + OFFSET
  let y = pos.clientY + OFFSET
  if (x + width  > window.innerWidth  - 8) x = pos.clientX - width  - OFFSET
  if (y + height > window.innerHeight - 8) y = pos.clientY - height - OFFSET

  el.style.left = `${Math.max(8, x)}px`
  el.style.top  = `${Math.max(8, y)}px`
  el.style.visibility = 'visible'
}

export function initBlockTooltips(blocklyDiv: HTMLElement, workspace: WorkspaceSvg): void {
  tooltipEl = document.createElement('div')
  tooltipEl.id = 'bt-root'
  tooltipEl.style.display = 'none'
  document.body.appendChild(tooltipEl)

  let currentType: string | null = null

  function hide(): void {
    tooltipEl!.style.display = 'none'
    currentType = null
  }

  // Blockly 自身のドラッグ開始イベントでツールチップを消す（DOM イベント不使用）
  workspace.addChangeListener((event) => {
    if (event.type === Events.BLOCK_DRAG) {
      const isStart = (event as unknown as { isStart?: boolean }).isStart
      if (isStart) hide()
    }
  })

  blocklyDiv.addEventListener('mousemove', (e: MouseEvent) => {
    if (!enabled) return

    const block = getBlockFromFlyout(e.target as Element, workspace)
    const data = block ? BLOCK_TOOLTIPS[block.type] : undefined

    if (!data) {
      hide()
      return
    }

    if (block!.type !== currentType) {
      currentType = block!.type
      renderTooltip(tooltipEl!, data)
    }
    positionTooltip(tooltipEl!, { clientX: e.clientX, clientY: e.clientY })
  })

  blocklyDiv.addEventListener('mouseleave', hide)
}
