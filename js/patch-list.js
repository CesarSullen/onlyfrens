const signatures = new WeakMap();

function sign(node) {
  signatures.set(node, node.outerHTML);
  node.querySelectorAll("[data-key]").forEach((child) => signatures.set(child, child.outerHTML));
}

function merge(parent, wanted) {
  [...parent.children].forEach((el) => {
    if (!el.dataset.key) el.remove();
  });
  const current = new Map([...parent.children].map((el) => [el.dataset.key, el]));
  let previous = null;

  wanted.forEach((node) => {
    let el = current.get(node.dataset.key);
    current.delete(node.dataset.key);

    if (!el) {
      sign(node);
      el = node;
    } else if (el.hasAttribute("data-nested")) {
      merge(el, [...node.children]);
    } else if (signatures.get(el) !== node.outerHTML) {
      sign(node);
      el.replaceWith(node);
      el = node;
    }

    const expected = previous ? previous.nextElementSibling : parent.firstElementChild;
    if (el !== expected) parent.insertBefore(el, expected);
    previous = el;
  });

  current.forEach((el) => el.remove());
}

// Updates a container from new HTML, touching only the keyed children that changed.
export function patchKeyed(container, html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  merge(container, [...template.content.children]);
}
