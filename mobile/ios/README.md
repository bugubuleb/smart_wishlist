# Smart Wishlist iOS Local Run Guide

Этот файл для заказчика: как быстро запустить iOS-версию локально и посмотреть приложение.

## Нужно ли скачивать весь проект

Нет, для просмотра iOS-клиента не обязательно тянуть весь репозиторий.
Достаточно папки `mobile` (React Native клиент) и доступа к рабочему backend URL.

## Вариант 1 (рекомендуется): скачать только `mobile` через sparse checkout

```bash
git clone --filter=blob:none --no-checkout https://github.com/bugubuleb/smart_wishlist.git
cd smart_wishlist
git sparse-checkout init --cone
git sparse-checkout set mobile
git checkout main
```

После этого в локальной копии будет только `mobile`.

## Вариант 2: ZIP

Можно скачать ZIP репозитория и оставить только папку `mobile`.
Для запуска iOS достаточно содержимого `mobile`.

## Системные требования

- macOS
- Xcode (последняя стабильная версия)
- Node.js 18+ (лучше 20 LTS)
- CocoaPods (`pod --version` должен работать)

## Установка зависимостей

```bash
cd mobile
npm install
cd ios
pod install
cd ..
```

## Настройка API

По умолчанию мобильное приложение ходит в:

`https://smartwishlist-production.up.railway.app/api`

Если нужен другой backend, запусти так:

```bash
SMARTWISHLIST_API_URL=https://<your-backend-domain>/api npm run ios
```

Важно: указывать URL без завершающего `/`.

## Запуск iOS в симуляторе

```bash
cd mobile
npm run ios
```

Или через Xcode:

1. Открыть `mobile/ios/HelloWorld.xcworkspace`
2. Выбрать симулятор
3. Нажать `Run`

## Запуск на физическом iPhone по кабелю

1. Подключить iPhone к Mac по USB
2. В Xcode открыть `mobile/ios/HelloWorld.xcworkspace`
3. Выбрать устройство (iPhone) в target selector
4. В `Signing & Capabilities` выбрать свою Team (личный Apple ID подходит для локального запуска)
5. Нажать `Run`

## Что уже работает в этой версии

- Логин/регистрация
- Мои/шаренные вишлисты
- Добавление товаров
- Вклады/резервы/ответственный
- Локализация
- Темы
- Валюта пользователя и конвертация в отображении
- Бейдж непрочитанных уведомлений на колокольчике

## Ограничение

- Полноценные нативные iOS push через APNs в этой сборке отключены.
  In-app уведомления и бейджи внутри приложения работают.

## Быстрый smoke test

1. Зарегистрироваться
2. В Settings сменить Currency на `USD`
3. Открыть список вишлистов: суммы должны отображаться в `USD`
4. Создать тестовый вишлист и товар
5. Проверить вкладку Notifications: при наличии непрочитанных должен быть красный бейдж

