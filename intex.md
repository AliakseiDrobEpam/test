Плюсы выбранного подхода
Строгая типизация (TypeScript):

Благодаря <K extends keyof HTMLElementTagNameMap>, TypeScript знает точный тип возвращаемого элемента (например, el('button') возвратит именно HTMLButtonElement со всеми его специфичными методами и свойствами, а не просто HTMLElement).
Использование магии типов в EventAttributes (on${Capitalize<K & string>}) автоматически генерирует правильные имена событий (onClick, onInput, onSubmit и т.д.) и страхует от опечаток.
Производительность и отсутствие лишних абстракций:

Нет виртуального DOM (Virtual DOM) и связанного с ним overhead (затрат на diff-алгоритмы). Создание элементов идет напрямую через нативные методы document.createElement, element.append и т.д.
Гибкость атрибутов и свойств:

Код умно разделяет работу:
События вешаются корректно (через element.onclick / Reflect.set).
Прямые свойства DOM-элементов (вроде value, checked, disabled, className или кастомных полей) записываются напрямую через Reflect.set(element, key, value).
Обычные HTML-атрибуты устанавливаются через element.setAttribute.
Удобный синтаксис (Developer Experience):

Возможность передавать дочерние элементы как массив или через rest-параметры (...children), а также автоматическое преобразование строк и чисел в текстовые ноды делают написание UI-кода похожим на JSX, но без необходимости настраивать сборщик (Babel/TypeScript transformers).
Минусы и потенциальные проблемы
Передача событий через Reflect.set(element, key.toLowerCase(), value):

Проблема со стилем событий: В TypeScript вы объявили ключи с большой буквой после on (например, onClick), но в коде вы делаете .toLowerCase(). Это превратит onClick в onclick. В данном случае это работает, но key.toLowerCase() ломает кейс, если вдруг имя события окажется составным (например, если бы вы передавали onPointerEnter, то .toLowerCase() превратит его в onpointerenter, что в целом сработает для стандартных событий, но нарушит чистоту стиля camelCase в JS/TS свойствах). Лучше просто приводить к нижнему регистру саму часть после on или использовать element.addEventListener.
Отсутствие удаления/обновления слушателей: Если этот компонент потребуется перерисовывать или обновлять (re-rendering), простой el() создает новый элемент. Но если бы вы захотели обновить свойства существующего элемента, присвоение element.onclick = value просто перезапишет старый обработчик (что может быть ок для одноразового рендера, но опасно при реактивных обновлениях).
Ограничения key in element:

Проверка if (key in element) работает хорошо для стандартных свойств, но иногда поведение TypeScript / DOM может подводить. Например, атрибуты вроде class (в JS свойство называется className) или for (в JS — htmlFor) не пройдут проверку key in element для произвольных коротких имен, если вы захотите передать их напрямую без setAttribute. (Хотя у вас для примитивов предусмотрен фоллбек на element.setAttribute, так что это отчасти скомпенсировано).
Управление состоянием и рендеринг:

Это не столько минус самой функции el, сколько следствие подхода: у вас нет реактивности из коробки. При изменении состояния магазина вам придется вручную находить нужные элементы в DOM и обновлять их (либо пересоздавать дерево компонентов заново). Для небольшого проекта это нормально, но на масштабах больше среднего может привести к рутинному «спагетти-коду» манипуляций с DOM.
Уязвимости безопасности (XSS):

Функция appendChildren делает document.createTextNode(String(child)). Это безопасно в плане XSS, так как текст экранируется браузером. Однако, если вы планируете когда-нибудь вставлять «сырой» HTML (чего сейчас в коде нет, но часто хочется сделать в виде innerHTML), это потребует строгой валидации, чтобы избежать уязвимостей.

Рекомендации по улучшению
Безопасная работа с именами событий:
Вместо Reflect.set(element, key.toLowerCase(), value) для событий надежнее и гибче использовать addEventListener:

TYPESCRIPT


if (key.startsWith('on')) {
  const eventName = key.slice(2).toLowerCase();
  element.addEventListener(eventName, value as EventListener);
  return;
}
Это позволит избежать проблем с кастомными событиями и множественными лисенерами, если это понадобится в будущем.

Поддержка className / class:
Убедитесь, что вам удобно передавать классы. Часто разработчики привыкают писать class: 'my-class' или className: 'my-class'. Если передать className, то key in element сработает, а вот если class, то сработает setAttribute('class', ...) — в данном случае браузеры обрабатывают это нормально, но стоит держать в голове разницу между DOM-свойствами и HTML-атрибутами.

В целом, архитектура очень чистая, лаконичная и отлично подходит для учебного или небольшого продакшен-проекта на Vanilla TS! Хотите развить эту тему или добавить к ней простую реактивность?


Usage Statistics
ORCHESTRATOR/TOOL	DEPLOYMENT ID	PROMPT TOKENS	COMPLETION TOKENS	COST, $
Orchestrator	gemini-3.5-flash-lite	6846	1423	0.0056113
Total	-	-	-	0.0056113





3 hours ago
да

3 hours ago




Отлично! Давайте добавим в наш микро-фреймворк простую реактивность без подключения тяжелых библиотек.

Мы сделаем так, чтобы состояние (State) могло автоматически обновлять конкретные узлы в DOM, когда его данные меняются. Для этого мы реализуем два ключевых инструмента:

Сигнал (Signal) — примитив реактивности, который хранит значение и уведомляет подписчиков об изменении.
Интеграцию сигналов в функцию el, чтобы текстовые ноды и атрибуты могли динамически обновляться при изменении сигнала, не пересоздавая весь компонент целиком.
1. Реализация реактивности (Сигналы)
Создадим простой класс или функцию для сигнала и механизм подписок:

TYPESCRIPT


// Простой паттерн Observer (Сигнал)
type Listener = (value: any) => void;

export class Signal<T> {
  private value: T;
  private listeners: Set<Listener> = new Set();

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  get(): T {
    return this.value;
  }

  set(newValue: T): void {
    if (this.value !== newValue) {
      this.value = newValue;
      this.notify();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Возвращаем функцию отписки
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.value));
  }
}

// Удобная фабричная функция
export function signal<T>(initialValue: T): Signal<T> {
  return new Signal(initialValue);
}
2. Обновление типов и функции el
Теперь расширим типы Child и Attributes, чтобы они могли принимать не только обычные значения, но и наши сигналы (Signal<T>). Когда в атрибут или дочерний элемент передается сигнал, мы подписываемся на его изменения и точечно обновляем DOM.

TYPESCRIPT


type EventAttributes = {
  [K in keyof HTMLElementEventMap as `on${Capitalize<K & string>}`]?: (
    event: HTMLElementEventMap[K],
  ) => void;
};

// Разрешаем передавать сигналы как значения атрибутов или дочерних элементов
type Signalable<T> = T | Signal<T>;

type Attributes = Record<string, Signalable<unknown>> & EventAttributes;

type Child = Signalable<Node | string | number | null | undefined | false>;

function setAttributes(element: HTMLElement, attributes: Attributes): void {
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === null || value === undefined) return;

    if (key.startsWith('on')) {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, value as EventListener);
      return;
    }

    // Обработка атрибута/свойства, если оно является сигналом
    if (value instanceof Signal) {
      const updateAttribute = (val: unknown) => {
        if (val === null || val === undefined) {
          element.removeAttribute(key);
          return;
        }
        if (key in element) {
          Reflect.set(element, key, val);
        } else {
          element.setAttribute(key, String(val));
        }
      };

      // Устанавливаем начальное значение
      updateAttribute(value.get());
      // Подписываемся на обновления
      value.subscribe(updateAttribute);
      return;
    }

    // Стандартная установка статичных значений
    if (key in element) {
      Reflect.set(element, key, value);
      return;
    }

    if (['string', 'number', 'boolean'].includes(typeof value)) {
      element.setAttribute(key, String(value));
    }
  });
}

function appendChildren(element: HTMLElement, children: Child[]): void {
  children.forEach((child) => {
    if (child === null || child === undefined || child === false) return;

    if (child instanceof Signal) {
      // Создаем текстовую ноду-заглушку для динамического контента
      const textNode = document.createTextNode(String(child.get() ?? ''));
      element.append(textNode);

      // Подписываемся на изменения сигнала
      child.subscribe((newValue) => {
        textNode.nodeValue = String(newValue ?? '');
      });
    } else {
      element.append(
        child instanceof Node ? child : document.createTextNode(String(child))
      );
    }
  });
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  attributes: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  setAttributes(element, attributes);
  appendChildren(element, children);

  return element;
}
3. Пример использования в интернет-магазине
Вот как лаконично и реактивно теперь можно написать счетчик товара в корзине или калькулятор цены:

TYPESCRIPT


import { el, signal } from './ui';

function CounterComponent() {
  // Создаем реактивный сигнал со значением 1
  const count = signal(1);
  const pricePerItem = 500;

  // Вычисляемый сигнал для общей суммы (можно оформить проще или через эффекты, но пока так)
  const totalPrice = signal(count.get() * pricePerItem);

  // Функция изменения количества
  const increment = () => {
    const next = count.get() + 1;
    count.set(next);
    totalPrice.set(next * pricePerItem);
  };

  const decrement = () => {
    if (count.get() > 1) {
      const next = count.get() - 1;
      count.set(next);
      totalPrice.set(next * pricePerItem);
    }
  };

  return el(
    'div',
    { className: 'cart-item' },
    el('span', {}, 'Товар "TypeScript Handbook"'),
    
    // Кнопка уменьшения
    el('button', { onClick: decrement }, '-'),
    
    // Динамический текст количества (обновится сам!)
    el('span', { className: 'count' }, count),
    
    // Кнопка увеличения
    el('button', { onClick: increment }, '+'),
    
    // Динамическая общая стоимость
    el('div', {}, 'Итого: ', totalPrice, ' руб.')
  );
}

// Добавляем в DOM
document.body.append(CounterComponent());
Плюсы такого подхода:
Минимум кода: Добавлено всего ~30 строк логики для поддержки сигналов.
Точечный DOM-удар (Fine-grained reactivity): При изменении count перерисовывается не весь компонент и не все дерево, а меняется ровно одно текстовое значение (textNode.nodeValue = ...). Это работает очень быстро.
Никакой магии сборщика: Никаких Proxy для глубоких объектов (пока что), чистый функциональный подход, понятный от первой до последней строки.
<img width="626" height="619" alt="image" src="https://github.com/user-attachments/assets/631bd4c2-ef12-4a0d-aada-0545e14eb7da" />
<img width="695" height="605" alt="image" src="https://github.com/user-attachments/assets/1e560c9a-839e-4308-83c4-2f81bdfaedbd" />
<img width="678" height="342" alt="image" src="https://github.com/user-attachments/assets/b6c356a7-80c0-40e4-9a1a-8700801ca6cf" />
<img width="637" height="567" alt="image" src="https://github.com/user-attachments/assets/153615d8-9d7f-41e9-b9d7-4e4cbdd8cd99" />
<img width="641" height="230" alt="image" src="https://github.com/user-attachments/assets/0f8eb6ab-67f2-4a5b-a2fc-ae6bbef304c3" />




