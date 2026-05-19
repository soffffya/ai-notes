# AI Notes

`AI Notes` — fullstack-приложение для быстрых заметок с AI-помощником, который помогает автоматически поддерживать порядок в записях.

## Что умеет приложение

- быстрый ввод заметок без лишних шагов
- автоматическое сохранение заметки
- категории и списки
- AI-анализ заметки после сохранения
- автоматическое действие при высокой уверенности AI
- предложение действия при средней уверенности AI
- `Undo` для AI-действий
- `Undo` для destructive-действий в интерфейсе
- светлая и тёмная тема
- русский и английский язык интерфейса
- пользовательский `OpenAI API key` в настройках

## Стек

- `frontend`: React + Vite + React Router + Tailwind CSS + shadcn/ui + i18next
- `backend`: NestJS + Prisma + PostgreSQL + JWT
- `AI`: OpenAI API

## Основной сценарий

1. Пользователь создаёт заметку.
2. Заметка сразу сохраняется.
3. AI анализирует содержание заметки асинхронно.
4. Если AI уверен:
   - назначает категорию, или
   - превращает заметку в пункт существующего списка.
5. Если уверенность средняя:
   - показывает предложение, которое можно применить вручную.
6. Любое автоматическое действие можно откатить.

## Реализованные возможности

### Аутентификация

- регистрация и вход
- JWT access token
- восстановление сессии после refresh
- защита frontend routes и backend endpoints

### Заметки

- создание
- просмотр
- редактирование
- autosave
- удаление
- смена категории

### Категории

- системная категория `Без категории`
- создание пользовательских категорий
- защита от дублей
- удаление категории с переносом заметок в системную категорию

### Списки

- создание списка
- просмотр списка
- добавление пунктов
- удаление пунктов
- отметка `done`
- drag-and-drop reorder
- защита от дублей

### AI

- классификация заметки через OpenAI API
- `assign_category`
- `add_to_list`
- пороги уверенности:
  - auto apply
  - suggestion
  - no-op
- откат AI-действий через backend

### UX

- тосты
- delayed undo для удалений
- loading / empty / error states
- тёмная тема
- локализация `ru/en`

## Структура проекта

```text
.
├── backend
│   ├── prisma
│   └── src
├── docs
├── frontend
│   └── src
├── docker-compose.yml
└── package.json
```

## Быстрый запуск

1. Скопировать env-файлы:
   - `cp backend/.env.example backend/.env`
   - `cp frontend/.env.example frontend/.env`
2. Поднять PostgreSQL:
   - `docker compose up -d db`
3. Установить зависимости:
   - `npm install`
4. Сгенерировать Prisma client и применить миграции:
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
5. Запустить backend:
   - `npm run dev:backend`
6. Запустить frontend:
   - `npm run dev:frontend`

## Переменные окружения

### Backend

- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_AUTO_APPLY_THRESHOLD`
- `AI_SUGGEST_THRESHOLD`
- `AI_UNDO_WINDOW_SECONDS`

### Frontend

- клиентские переменные из `frontend/.env.example`

Важно:
- если `OPENAI_API_KEY` не задан на backend, пользователь может указать свой ключ в настройках приложения
- frontend передаёт его в заголовке `X-OpenAI-Api-Key`

## Архитектура

### Frontend

- экран приложения собран в [frontend/src/pages/HomePage.tsx](./frontend/src/pages/HomePage.tsx)
- UI-компоненты экрана вынесены в `frontend/src/components/home`
- side-effect и orchestration logic вынесены в `frontend/src/hooks`

Основные хуки:

- `use-ai-actions`
- `use-note-editor`
- `use-list-dnd`
- `use-undo-queue`
- `use-workspace-data`

### Backend

Модули backend:

- `auth`
- `notes`
- `categories`
- `lists`
- `ai`
- `prisma`

### Domain rules

Основные продуктовые правила и MVP-ограничения описаны в [docs/domain-model.md](./docs/domain-model.md).

## Проверка сборки

- `npm run build --workspace backend`
- `npm run build --workspace frontend`

## Что уже сделано хорошо

- есть полный fullstack flow
- есть AI-сценарий, а не только CRUD
- есть undo-механика
- есть i18n и темы
- есть декомпозиция frontend-экрана и side-effect логики

## Что можно улучшить дальше

- добавить automated tests на critical flow
- сделать публичный deploy для демо
- добавить скриншоты или gif в README
- оформить CI
- вынести часть CRUD-логики в более явный service layer на frontend

## MCP

В проекте есть [`.mcp.json`](./.mcp.json) с конфигурацией `shadcn` MCP для локальной работы с компонентами.
