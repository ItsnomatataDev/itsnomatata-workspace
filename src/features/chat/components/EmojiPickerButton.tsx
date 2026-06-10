import { useMemo, useState } from "react";
import { SmilePlus } from "lucide-react";

const EMOJI_GROUPS = [
  {
    label: "Smileys",
    emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🫣 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 🫤 🙁 ☹️ 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👻 👽 🤖".split(" "),
  },
  {
    label: "Gestures",
    emojis: "👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦".split(" "),
  },
  {
    label: "People",
    emojis: "👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 🧑‍⚕️ 🧑‍🎓 🧑‍🏫 🧑‍⚖️ 🧑‍🌾 🧑‍🍳 🧑‍🔧 🧑‍🏭 🧑‍💼 🧑‍🔬 🧑‍💻 🧑‍🎤 🧑‍🎨 🧑‍✈️ 🧑‍🚀 🧑‍🚒 👮 🕵️ 💂 🥷 👷 🫅 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🫃 🫄 👼 🎅 🤶 🧑‍🎄 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟".split(" "),
  },
  {
    label: "Hearts",
    emojis: "💌 💘 💝 💖 💗 💓 💞 💕 💟 ❣️ 💔 ❤️‍🔥 ❤️‍🩹 ❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💋 💯 💢 💥 💫 💦 💨 🕳️ 💬 👁️‍🗨️ 🗨️ 🗯️ 💭 💤".split(" "),
  },
  {
    label: "Work",
    emojis: "✅ ☑️ ✔️ ❌ ❎ ⚠️ 🚫 🔒 🔓 🔐 🔑 🗝️ 📌 📍 📎 🖇️ 📅 📆 🗓️ ⏰ ⏱️ ⏲️ 🕰️ 💼 📁 📂 🗂️ 📄 📃 📑 🧾 📊 📈 📉 🧮 💻 🖥️ 🖨️ ⌨️ 🖱️ 💾 💿 📱 ☎️ 📞 📧 📨 📩 📤 📥 🔎 💡 🔧 🔨 ⚙️ 🧰 🪛 🧲 🧪 🧬 🩺 💊 🧯 🛡️".split(" "),
  },
  {
    label: "Objects",
    emojis: "🎉 🎊 🎁 🎈 🪩 🪄 🧸 🖼️ 🎨 🧵 🪡 👓 🕶️ 🥽 🥼 🦺 👔 👕 👖 🧢 👑 💍 💎 🔋 🪫 🔌 💡 🕯️ 🪔 🧭 🧱 🪜 🪑 🚪 🪟 🛏️ 🛋️ 🚿 🛁 🧴 🧻 🧼 🪥 🧽 🧹 🧺 🛒 🚬 ⚰️ 🪦 ⚱️ 🗿 🪧".split(" "),
  },
  {
    label: "Food",
    emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🥙 🧆 🌮 🌯 🫔 🥗 🥘 🫕 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🥛 ☕ 🫖 🍵 🧃 🥤 🧋 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉".split(" "),
  },
  {
    label: "Travel",
    emojis: "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍️ 🛺 🚲 🛴 🛹 🛼 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🚁 🚀 🛸 🚢 ⛵ 🛶 🚤 🛥️ 🛳️ ⛽ 🚧 🚦 🚥 🗺️ 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ 🛖 🏠 🏡 🏢 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏭 🏗️".split(" "),
  },
  {
    label: "Nature",
    emojis: "🌍 🌎 🌏 🌐 🗺️ 🌋 🗻 🏕️ 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 🌪️ 🌫️ 🌈 ☔ ⚡ ⭐ 🌟 ✨ ☄️ 💥 🔥 🌊 🎄 🌲 🌳 🌴 🌵 🌾 🌿 ☘️ 🍀 🍁 🍂 🍃 🪴 🌱 🌷 🌹 🥀 🌺 🌸 🌼 🌻".split(" "),
  },
  {
    label: "Symbols",
    emojis: "🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 🟫 ⬛ ⬜ ◼️ ◻️ ◾ ◽ ▪️ ▫️ 🔶 🔷 🔸 🔹 🔺 🔻 💠 🔘 🔳 🔲 ♻️ 🔰 ⚜️ 🔱 ⚛️ 🕉️ ✡️ ☸️ ☯️ ✝️ ☦️ ☪️ ☮️ 🕎 🔯 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⛎ ▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ 🔀 🔁 🔂".split(" "),
  },
];

export default function EmojiPickerButton({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(0);
  const emojis = useMemo(() => EMOJI_GROUPS[activeGroup]?.emojis ?? [], [activeGroup]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        title="Insert emoji"
        aria-label="Insert emoji"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SmilePlus size={18} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Emoji picker"
          className="absolute bottom-full left-0 z-40 mb-3 w-80 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black/60"
        >
          <div className="flex gap-1 overflow-x-auto border-b border-white/10 p-2">
            {EMOJI_GROUPS.map((group, index) => (
              <button
                key={group.label}
                type="button"
                onClick={() => setActiveGroup(index)}
                className={[
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                  activeGroup === index
                    ? "bg-white text-neutral-950"
                    : "text-white/55 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                {group.label}
              </button>
            ))}
          </div>

          <div className="grid max-h-72 grid-cols-8 gap-1 overflow-y-auto p-3">
            {emojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-lg transition hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
