
# Схема деплою — thesis-i.com Kubernetes кластер

Цей документ описує **єдиний правильний спосіб** розгорнути сервіс на кластері.  
Читай його перед тим як писати будь-який Dockerfile, k8s-маніфест або CI workflow.

---

## 1. Огляд інфраструктури

```
GitHub (source) ──push──► GitHub Actions (build)
                                │
                           GHCR image (ghcr.io/nulp-ai-enterprise/<repo>:sha-XXXXXXX)
                                │
                       ArgoCD auto-sync (watches k8s/)
                                │
                    Kubernetes кластер (nulp-k8s-2)
                         IP: 100.107.206.16:6443
                                │
                    Traefik Ingress ──► *.thesis-i.com
```

**Компоненти кластера:**
| Компонент | Namespace | Призначення |
|-----------|-----------|-------------|
| ArgoCD | `argocd` | GitOps auto-sync з GitHub |
| Sealed Secrets (bitnami) | `kube-system` | Шифрування секретів у Git |
| Traefik | `kube-system` | Ingress controller + TLS |

**Існуючі сервіси:**
| Сервіс | Namespace | Домен | GHCR image |
|--------|-----------|-------|------------|
| FastAPI backend | `zzk-register` | `zzk-registr.thesis-i.com` | `ghcr.io/nulp-ai-enterprise/zzk-rep-back` |
| Next.js frontend | `zzk-front` | `zzk.thesis-i.com` | `ghcr.io/nulp-ai-enterprise/zzk-rep-front` |

**Внутрішня адреса між сервісами:**
```
http://<service-name>.<namespace>.svc.cluster.local:<port>
# Приклад: http://zzk-register.zzk-register.svc.cluster.local:8000
```

---

## 2. Структура репозиторію

```
my-service/
├── Dockerfile
├── k8s/
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── secret.yaml          ← локально, в .gitignore
│   ├── sealed-secret.yaml   ← комітити
│   └── argocd-app.yaml
└── .github/
    └── workflows/
        └── docker-build.yml
```

`.gitignore` обов'язково:
```
k8s/secret.yaml
```

---

## 3. Dockerfile

### Next.js (App Router, output: standalone)

```dockerfile
# Stage 1: deps
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# Stage 2: builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs
COPY --from=builder /app/public              ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

`next.config.ts` обов'язково:
```ts
const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
};
```

### Python / FastAPI

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

**Правила для будь-якого Dockerfile:**
- Ніколи не копіювати `.env` файли
- Секрети передаються через env vars з k8s Secret (не build args)
- Health check endpoint обов'язковий (`/api/health` або `/health`)
- Образ має запускатись від non-root користувача

---

## 4. Kubernetes маніфести

### namespace.yaml
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: my-service
  labels:
    app.kubernetes.io/managed-by: argocd
```

### deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
  namespace: my-service
  labels:
    app: my-service
spec:
  replicas: 1
  strategy:
    type: Recreate          # для stateful або single-replica — завжди Recreate
  selector:
    matchLabels:
      app: my-service
  template:
    metadata:
      labels:
        app: my-service
    spec:
      containers:
        - name: my-service
          # CI автоматично оновлює цей тег після кожного push
          image: ghcr.io/nulp-ai-enterprise/my-service:sha-XXXXXXX
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 3000   # або 8000 для Python
          env:
            - name: NODE_ENV
              value: production
            - name: MY_SECRET_VAR
              valueFrom:
                secretKeyRef:
                  name: my-service-secret
                  key: MY_SECRET_VAR
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 512Mi
          startupProbe:
            httpGet:
              path: /api/health
              port: 3000
            failureThreshold: 12   # 12×10s = 2 хв на старт
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
      imagePullSecrets:
        - name: ghcr-secret    # існує в кожному namespace — створити вручну один раз
```

**Створити `ghcr-secret` в новому namespace (один раз вручну):**
```bash
kubectl create secret docker-registry ghcr-secret \
  --namespace=my-service \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-pat-with-read-packages>
```

### service.yaml
```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: my-service
spec:
  type: ClusterIP
  selector:
    app: my-service
  ports:
    - name: http
      port: 3000        # або 8000
      targetPort: http
```

### ingress.yaml
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-service
  namespace: my-service
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
spec:
  ingressClassName: traefik
  rules:
    - host: my-service.thesis-i.com   # субдомен thesis-i.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-service
                port:
                  number: 3000
```

### secret.yaml (локальний шаблон, не комітити)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-service-secret
  namespace: my-service
type: Opaque
stringData:
  DATABASE_URL: "postgresql+asyncpg://user:pass@host/db"
  MY_SECRET_VAR: "value"
```

### sealed-secret.yaml (генерується, комітити)
```bash
# Переконайся що kubeconfig вказує на правильний кластер:
kubectl config set-cluster nulp-k8s-2 --server=https://100.107.206.16:6443

# Запечатати:
kubeseal --format yaml --controller-name=sealed-secrets-controller --controller-namespace=kube-system < k8s/secret.yaml > k8s/sealed-secret.yaml
```

### argocd-app.yaml (реєструє сервіс в ArgoCD, застосовується один раз)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-service
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/NULP-AI-Enterprise/my-service-repo.git
    targetRevision: main
    path: k8s/
  destination:
    server: https://kubernetes.default.svc
    namespace: my-service
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  ignoreDifferences:
    - group: bitnami.com
      kind: SealedSecret
      jsonPointers:
        - /spec/encryptedData
```

**Застосувати один раз:**
```bash
kubectl apply -f k8s/argocd-app.yaml
```

---

## 5. GitHub Actions CI workflow

```yaml
name: Build & Push Docker image

on:
  workflow_dispatch:
  push:
    branches: [main, master]
    paths:
      - "app/**"
      - "components/**"
      - "lib/**"
      - "Dockerfile"
      - "package.json"
      - "package-lock.json"
      # для Python: "**/*.py", "requirements.txt"

env:
  REGISTRY: ghcr.io
  IMAGE:    ghcr.io/nulp-ai-enterprise/my-service

jobs:
  # Опціонально: typecheck для TypeScript проектів
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci --frozen-lockfile
      - run: npx next typegen    # генерує next-env.d.ts (Next.js обов'язково)
        env:
          BACKEND_URL: "http://localhost:8000"
      - run: npx tsc --noEmit

  build-and-push:
    runs-on: ubuntu-latest
    needs: typecheck             # видалити якщо typecheck не потрібен
    permissions:
      contents: write            # щоб писати в deployment.yaml
      packages: write            # щоб пушити в GHCR

    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/setup-buildx-action@v3

      - name: Generate image tags
        id: meta
        run: |
          SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
          echo "sha_tag=sha-${SHORT_SHA}" >> "$GITHUB_OUTPUT"

      - name: Build & push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ${{ env.IMAGE }}:${{ steps.meta.outputs.sha_tag }}
            ${{ env.IMAGE }}:latest
          cache-from: type=gha
          cache-to:   type=gha,mode=max

      - name: Pin image SHA in deployment.yaml
        run: |
          TAG="${{ steps.meta.outputs.sha_tag }}"
          sed -i "s|image: ${{ env.IMAGE }}:.*|image: ${{ env.IMAGE }}:${TAG}|g" k8s/deployment.yaml
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add k8s/deployment.yaml
          git diff --staged --quiet || git commit -m "ci: pin image to ${TAG} [skip ci]"
          git push
```

**Важливо:** `[skip ci]` в повідомленні CI-коміту запобігає нескінченному циклу збірки.

---

## 6. Типовий workflow нового сервісу (покрокова інструкція)

```bash
# 1. Створити репозиторій на GitHub в організації NULP-AI-Enterprise

# 2. Підготувати файли (Dockerfile, k8s/, .github/workflows/, .gitignore)

# 3. Заповнити k8s/secret.yaml (НЕ комітити)

# 4. Запечатати секрет
kubectl config set-cluster nulp-k8s-2 --server=https://100.107.206.16:6443
kubeseal --format yaml --controller-name=sealed-secrets-controller --controller-namespace=kube-system < k8s/secret.yaml > k8s/sealed-secret.yaml

# 5. Створити ghcr-secret в namespace (один раз)
kubectl create namespace my-service
kubectl create secret docker-registry ghcr-secret \
  --namespace=my-service \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-pat>

# 6. Зареєструвати в ArgoCD (один раз)
kubectl apply -f k8s/argocd-app.yaml

# 7. Закомітити і запушити — CI збере образ і оновить deployment.yaml
git add . && git commit -m "feat: initial deployment" && git push

# 8. ArgoCD автоматично задеплоїть протягом ~2 хв
# Перевірити: kubectl get pods -n my-service
```

---

## 7. Чеклист перед пушем

- [ ] `k8s/secret.yaml` є в `.gitignore`
- [ ] `k8s/sealed-secret.yaml` згенеровано і закомічено
- [ ] `k8s/argocd-app.yaml` вказує правильний `repoURL` і `namespace`
- [ ] `ghcr-secret` існує в namespace кластера
- [ ] Health endpoint повертає 200 (`/api/health`)
- [ ] `deployment.yaml` має `imagePullSecrets: [{name: ghcr-secret}]`
- [ ] `ingress.yaml` використовує `ingressClassName: traefik`
- [ ] CI workflow має `permissions: contents: write, packages: write`

---

## 8. Діагностика

```bash
# Стан подів
kubectl get pods -n my-service

# Логи
kubectl logs -n my-service deploy/my-service --tail=100

# Опис поду (ImagePullBackOff, CrashLoopBackOff тощо)
kubectl describe pod -n my-service -l app=my-service

# ArgoCD статус
kubectl get application my-service -n argocd

# Перевірити секрет
kubectl get secret my-service-secret -n my-service

# Переконатись що kubeconfig вказує правильно
kubectl cluster-info
# має показати: https://100.107.206.16:6443
# якщо ні — виправити:
kubectl config set-cluster nulp-k8s-2 --server=https://100.107.206.16:6443
```

**Поширені помилки:**
| Симптом | Причина | Виправлення |
|---------|---------|-------------|
| `ImagePullBackOff` | `ghcr-secret` відсутній або в неправильному namespace | `kubectl create secret docker-registry ghcr-secret --namespace=my-service ...` |
| `i/o timeout` при kubeseal | kubeconfig вказує старий IP кластера | `kubectl config set-cluster nulp-k8s-2 --server=https://100.107.206.16:6443` |
| CI не тригериться | файли не входять в `paths:` фільтр | додати потрібний glob в `paths:` або запустити `workflow_dispatch` |
| Стара версія після деплою | CI-коміт не був запушений локально перед пушем | `git pull --rebase origin main && git push` |
| `[rejected] fetch first` при пуші | CI-бот запінував SHA поки ти працював | `git pull --rebase origin main && git push` |

---
---

# Розгортання `butiktoys-pos`

> Цей розділ — конкретика для застосунку **ButikToys POS** (каса магазину
> іграшок). Він **успадковує** всі загальні конвенції вище: GHCR, Sealed
> Secrets, Traefik, ArgoCD auto-sync, `ghcr-secret` у namespace. Нижче — лише
> те, що специфічне для цього сервісу.

| Параметр | Значення |
|----------|----------|
| Namespace | `butiktoys-pos` |
| Домен | `butiktoys.pos.thesis-i.com` |
| Образ застосунку | `ghcr.io/nulp-ai-enterprise/butiktoys-pos` |
| Образ міграцій | `ghcr.io/nulp-ai-enterprise/butiktoys-pos-migrator` |
| Порт | `3000` |
| Health endpoint | `GET /api/health` (перевіряє round-trip до Postgres) |
| Манифести | `k8s/` — готові до `kubectl apply` |

### ⚠️ Два відхилення від загальних конвенцій

1. **TLS-сертифікат.** Домен `butiktoys.pos.thesis-i.com` — **дві** мітки
   углиб. Wildcard `*.thesis-i.com` його **НЕ покриває** (wildcard матчить рівно
   одну мітку). Варіанти — у шапці `k8s/ingress.yaml`; найпростіший — узяти
   односкладовий хост `butiktoys-pos.thesis-i.com`, який уже покритий наявним
   wildcard.
2. **`typescript.ignoreBuildErrors` НЕ вмикається.** Загальний гайд пропонує
   його для Next.js; тут збірка навмисно падає на помилках типів, а CI-крок
   `verify` запускає `tsc --noEmit`. Каса рахує гроші — тихо пропускати
   помилки типів тут неприйнятно.

---

## 1. Перелік манифестів (`k8s/`)

| Файл | Що створює | Нотатки |
|------|-----------|---------|
| `namespace.yaml` | `Namespace butiktoys-pos` | |
| `configmap.yaml` | `ConfigMap butiktoys-pos-config` | несекретне: `SHOP_NAME`, `SHOP_TIMEZONE`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION` |
| `secret.example.yaml` | шаблон `Secret` | **не** застосовувати напряму — див. §3 |
| `postgres.yaml` | `StatefulSet` + headless `Service` + PVC 5Gi | видалити, якщо підключаєтесь до наявного Postgres |
| `minio.yaml` | `StatefulSet` + `Service` (ClusterIP) + PVC 10Gi | видалити, якщо є наявний MinIO/S3 |
| `deployment.yaml` | `Deployment` застосунку + 2 initContainers | `strategy: Recreate`, non-root, read-only rootfs |
| `service.yaml` | `Service butiktoys-pos` (ClusterIP:3000) | |
| `ingress.yaml` | `Ingress` (Traefik) | **прочитати шапку про TLS** |
| `argocd-app.yaml` | `Application` в `argocd` | застосовується один раз вручну |

Манифести перевірені `kubeconform -strict` проти схем Kubernetes 1.30.

### Підключення до вже наявних Postgres / MinIO

Замість in-cluster інстансів:

1. Видалити `k8s/postgres.yaml` і/або `k8s/minio.yaml`.
2. У Secret вказати зовнішні координати:
   `DATABASE_URL=postgresql://user:pass@<host>:5432/butiktoys?schema=public`,
   `S3_*` — на наявне сховище. У `configmap.yaml` замінити `S3_ENDPOINT`.
3. У `deployment.yaml` прибрати initContainer `wait-for-db` **або** замінити
   в ньому хост `butiktoys-postgres` на реальний.
4. База `butiktoys` має існувати — Prisma застосує міграції, але саму БД
   не створює.

Внутрішні адреси (за загальною конвенцією):
```
postgresql://butiktoys:<pass>@butiktoys-postgres.butiktoys-pos.svc.cluster.local:5432/butiktoys
http://butiktoys-minio.butiktoys-pos.svc.cluster.local:9000
```

---

## 2. Helm

Helm **не використовується** — це сирі YAML-манифести в `k8s/`, як і решта
сервісів кластера. ArgoCD синхронізує директорію напряму (`path: k8s/`).
`values.yaml` відповідно не потрібен; усе, що варіюється, — у ConfigMap і Secret.

---

## 3. Змінні середовища в Secret

`butiktoys-pos-secret` (namespace `butiktoys-pos`):

| Ключ | Призначення |
|------|------------|
| `DATABASE_URL` | повний DSN Postgres (пароль має збігатися з `POSTGRES_PASSWORD`) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD` | споживаються Postgres StatefulSet і initContainer `wait-for-db` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | вони ж `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (пароль ≥ 8 символів) |
| `SESSION_SECRET` | HMAC-ключ сесійної cookie, `openssl rand -base64 48`; ротація = вихід продавця з сесії |
| `APP_PIN` | PIN продавця |

Несекретне (`S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `SHOP_NAME`,
`SHOP_TIMEZONE`) — у ConfigMap, не в Secret.

```bash
cp k8s/secret.example.yaml k8s/secret.yaml    # k8s/secret.yaml у .gitignore
```

Заповнити реальні значення, потім запечатати (як у §4 загальної частини):

```bash
kubeseal --format yaml --controller-name=sealed-secrets-controller --controller-namespace=kube-system < k8s/secret.yaml > k8s/sealed-secret.yaml
```

Комітити **лише** `k8s/sealed-secret.yaml`.

---

## 4. Збірка і push образів

CI (`.github/workflows/docker-build.yml`) збирає **два** образи з одного
Dockerfile і пінує обидва теги в `k8s/deployment.yaml`:

| Stage | Образ | Роль |
|-------|-------|------|
| `runner` | `ghcr.io/nulp-ai-enterprise/butiktoys-pos` | застосунок (`output: standalone`, non-root) |
| `migrator` | `ghcr.io/nulp-ai-enterprise/butiktoys-pos-migrator` | Prisma CLI + міграції для initContainer |

Org і теги вже підставлені (`nulp-ai-enterprise`) — окремої заміни placeholder'ів
не потрібно. Перевірити, що нічого не лишилось:

```bash
grep -rn "REPLACE_ME" .github/workflows/docker-build.yml k8s/ || echo "ok"
```

Вручну (якщо без CI):

```bash
export ORG=nulp-ai-enterprise TAG=sha-$(git rev-parse --short=7 HEAD)
```

```bash
docker build --target runner   -t ghcr.io/$ORG/butiktoys-pos:$TAG          .
```

```bash
docker build --target migrator -t ghcr.io/$ORG/butiktoys-pos-migrator:$TAG .
```

```bash
docker push ghcr.io/$ORG/butiktoys-pos:$TAG && docker push ghcr.io/$ORG/butiktoys-pos-migrator:$TAG
```

---

## 5. ArgoCD Application

Структура — у `k8s/argocd-app.yaml`. Ключове:

| Поле | Значення |
|------|----------|
| `spec.source.repoURL` | `https://github.com/NULP-AI-Enterprise/crmbutiktoys.git` — вже вказано |
| `spec.source.targetRevision` | `main` |
| `spec.source.path` | `k8s/` |
| `spec.destination.namespace` | `butiktoys-pos` |
| `spec.syncPolicy.automated` | `prune: true`, `selfHeal: true` |
| `syncOptions` | `CreateNamespace=true` |

Додатково до загального шаблону є другий `ignoreDifferences` — на
`apps/StatefulSet` → `/spec/volumeClaimTemplates`: API-сервер дефолтить
`storageClassName`/`volumeMode`, і без цього Postgres та MinIO вічно
показуються як OutOfSync.

```bash
kubectl apply -f k8s/argocd-app.yaml
```

---

## 6. Міграції БД при деплої

Реалізовано **двома initContainers** у `deployment.yaml` (не окремим Job):

1. **`wait-for-db`** (`postgres:16-alpine`) — `pg_isready` у циклі, до 60×3 с.
   Потрібен, бо при першій установці Postgres ще піднімається.
2. **`migrate`** (образ `*-migrator`) — `npx prisma migrate deploy`.

Застосунок стартує лише якщо міграція завершилась кодом 0, тому схема ніколи
не відстає від коду, що її запитує. `migrate deploy` застосовує **тільки** вже
закомічені міграції, нічого не генерує і ніколи не питає підтверджень — саме це
робить його безпечним у автоматичному режимі.

**Чому не `PreSync` Job:** ArgoCD-хук виконується *до* синку, тож при першій
установці Postgres ще не існує і хук падає (далі — retry-цикл). initContainer
однаково коректно працює і на першій установці, і на оновленні, і не має
проблем з незмінюваністю полів Job.

`strategy: Recreate` (а не rolling) — щоб два поди різних версій ніколи не
працювали одночасно проти однієї БД і не гонялися за міграцією.

Порожня БД піднімається з нуля автоматично. Бакет MinIO створюється застосунком
при першому завантаженні фото — окремий provisioning-Job не потрібен.

---

## 6a. Каталог для покупців (`/shop`)

Публічний каталог керується **ConfigMap**, не Secret — це не таємниця:

```yaml
# k8s/configmap.yaml
PUBLIC_CATALOG_ENABLED: "true"
```

| Значення | Наслідок |
|----------|----------|
| `"true"` | `/shop`, `/api/public/catalog`, `/api/public/photo/*` відкриті без сесії |
| будь-що інше / ключ відсутній | усі три віддають 404; раніше надіслані посилання (в т.ч. на фото) перестають працювати |

Посилання для покупців: `https://<host>/shop` (кнопка «Поділитися» на екрані
«Каталог» показує його і копіює).

**Що публікується:** фото, назва, категорія, ціна, огрублена наявність
(`немає` / `залишились останні` при 1–3 / `в наявності`). Внутрішні коди,
штрих-коди, точні залишки і продажі — ні. Whitelist у
`src/lib/publicCatalog.ts`.

Змінили значення в ConfigMap — потрібен **перезапуск** поду (env читається на
старті, ArgoCD сам поди не перезапускає):

```bash
kubectl rollout restart deploy/butiktoys-pos -n butiktoys-pos
```

Бакет MinIO лишається **приватним** — фото для покупців ідуть через застосунок
(`/api/public/photo/*`), а не напряму з MinIO. Робити бакет анонімно-читабельним
(`mc anonymous set public`) не потрібно і не варто.

---

## 6b. Виправлено в манифестах

Дві проблеми, знайдені перед деплоєм — щоб не повернулись:

1. **`k8s/minio.yaml`** — `initContainers` був вкладений у `securityContext`
   (`kubeconform` відкидав StatefulSet: `additional properties 'initContainers'
   not allowed`). Крім невалідності, цей initContainer чекав на MinIO **власного
   ж поду** — головний контейнер не стартує, поки initContainer не завершиться,
   тобто гарантований дедлок. Бакет натомість створює застосунок
   (`ensureBucket()`), ідемпотентно і без окремого манифесту.
2. **`k8s/secret.example.yaml`** переміщено в `k8s/examples/` — ArgoCD синкає
   `path: k8s/` **нерекурсивно**, тому шаблон із `CHANGE_ME` більше не
   застосовується в кластер. Підкаталог свідомо не додано в `directory.recurse`.

---

## 7. Health check

`GET /api/health` — відкритий (без сесії), щоб kubelet міг його опитувати:

```json
{ "status": "ok", "database": "up", "timestamp": "..." }
```

`200` — БД відповідає; `503` — ні. MinIO **свідомо не перевіряється**:
недоступність фото псує каталог, але не повинна знімати касу з трафіку.

Використовується у трьох probes (`deployment.yaml`):

| Probe | Налаштування | Призначення |
|-------|-------------|-------------|
| `startupProbe` | `failureThreshold: 12`, `periodSeconds: 10` | до 2 хв на старт |
| `livenessProbe` | `periodSeconds: 30` | перезапуск при залипанні |
| `readinessProbe` | `periodSeconds: 10` | не пускати трафік без БД |

---

## 8. Перший деплой — покроково

```bash
# 1. Визначитись з TLS/хостом — див. шапку k8s/ingress.yaml
#    (org/registry/repoURL уже підставлені)

# 2. Переконатись, що код лежить у корені репозиторію crmbutiktoys

# 3. Заповнити і запечатати Secret
cp k8s/secret.example.yaml k8s/secret.yaml && $EDITOR k8s/secret.yaml
kubectl config set-cluster nulp-k8s-2 --server=https://100.107.206.16:6443
kubeseal --format yaml --controller-name=sealed-secrets-controller --controller-namespace=kube-system < k8s/secret.yaml > k8s/sealed-secret.yaml

# 4. ghcr-secret у новому namespace (один раз)
kubectl create namespace butiktoys-pos
kubectl create secret docker-registry ghcr-secret \
  --namespace=butiktoys-pos \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-pat-with-read-packages>

# 5. Зареєструвати в ArgoCD (один раз)
kubectl apply -f k8s/argocd-app.yaml

# 6. Пуш — CI збере обидва образи і запінує теги
git add . && git commit -m "feat: butiktoys-pos initial deployment" && git push

# 7. Перевірити
kubectl get pods -n butiktoys-pos
kubectl logs -n butiktoys-pos deploy/butiktoys-pos -c migrate
curl -sS https://butiktoys.pos.thesis-i.com/api/health
```

---

## 9. Чекліст (додатково до загального в §7)

- [ ] Код лежить у корені репо `crmbutiktoys` (а не у вкладеній теці)
- [ ] Питання TLS для дволанкового домену вирішене (див. §⚠️)
- [ ] Пароль у `DATABASE_URL` збігається з `POSTGRES_PASSWORD`
- [ ] `S3_SECRET_KEY` ≥ 8 символів (вимога MinIO)
- [ ] `SESSION_SECRET` ≥ 32 символів, згенерований випадково
- [ ] `APP_PIN` змінений з дефолтного
- [ ] `k8s/secret.yaml` не закомічений, `k8s/sealed-secret.yaml` — закомічений
- [ ] Обидва теги образів (`butiktoys-pos` і `-migrator`) вказують на один SHA
- [ ] StorageClass кластера підтримує `ReadWriteOnce` для двох PVC
- [ ] `PUBLIC_CATALOG_ENABLED` у ConfigMap відповідає намірам (публікувати каталог чи ні)
- [ ] `kubeconform -strict k8s/*.yaml` проходить без `Invalid`

---

## 10. Діагностика (специфіка застосунку)

```bash
# Логи міграції — найчастіше джерело падінь при першому старті
kubectl logs -n butiktoys-pos deploy/butiktoys-pos -c migrate
kubectl logs -n butiktoys-pos deploy/butiktoys-pos -c wait-for-db

# Застосунок
kubectl logs -n butiktoys-pos deploy/butiktoys-pos -c butiktoys-pos --tail=100

# Які міграції вже застосовані (psql є у поді Postgres, не в поді застосунку)
kubectl exec -n butiktoys-pos butiktoys-postgres-0 -- \
  psql -U butiktoys -d butiktoys -c \
  'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;'

# PVC і сховище
kubectl get pvc -n butiktoys-pos
```

| Симптом | Причина | Виправлення |
|---------|---------|-------------|
| Pod у `Init:0/2`, довго | Postgres ще піднімається або PVC не забіндився | `kubectl get pvc -n butiktoys-pos`, `kubectl describe pod` |
| `Init:Error` на `migrate` | `DATABASE_URL` не збігається з `POSTGRES_PASSWORD`, або БД не існує | перевірити Secret; створити базу `butiktoys` |
| `503` на `/api/health` | застосунок не бачить Postgres | перевірити Service `butiktoys-postgres` і DSN |
| Фото не зберігаються | `S3_SECRET_KEY` < 8 символів → MinIO не стартує | подивитись логи поду `butiktoys-minio` |
| Фото не відкриваються | невірний `S3_ENDPOINT` у ConfigMap | має бути `http://butiktoys-minio:9000` |
| Камера не запускається на телефоні | сторінка не по HTTPS, або немає дозволу | `getUserMedia` вимагає TLS; перевірити сертифікат хоста |
| `Постійний OutOfSync` на StatefulSet | дефолти `volumeClaimTemplates` | `ignoreDifferences` уже є в `argocd-app.yaml` |
| Продавця розлогінює після редеплою | змінився `SESSION_SECRET` | тримати ключ стабільним у Secret |
| `/shop` віддає 404 | `PUBLIC_CATALOG_ENABLED` не `"true"`, або под не перезапущено після зміни ConfigMap | `kubectl rollout restart deploy/butiktoys-pos -n butiktoys-pos` |
| Фото в публічному каталозі не видно | `PUBLIC_CATALOG_ENABLED` вимкнено (гейтить і фото), або фото не завантажено | перевірити ConfigMap і под `butiktoys-minio` |
| MinIO под висить в `Init:0/1` | повернувся initContainer, що чекає на власний под | див. §6b — бакет створює застосунок |

---
---

# Розгортання `personal-crm`

> Цей розділ — конкретика для застосунку **Personal Networking CRM** (легкий
> graph CRM для персонального нетворкінгу, з AI-розбором нотаток через
> OpenAI `gpt-4o-mini`). Він **успадковує** всі загальні конвенції з §1 вище:
> GHCR, Sealed Secrets, Traefik, ArgoCD auto-sync, `ghcr-secret` у namespace.
> Нижче — лише те, що специфічне для цього сервісу.

| Параметр | Значення |
|----------|----------|
| Namespace | `personal-crm` |
| Домен | `personal-crm.thesis-i.com` |
| Образ застосунку | `ghcr.io/nulp-ai-enterprise/personal-crm` |
| Образ міграцій | `ghcr.io/nulp-ai-enterprise/personal-crm-migrator` |
| Порт | `3000` |
| Health endpoint | `GET /api/health` (перевіряє round-trip до Postgres) |
| Манифести | `k8s/` — готові до `kubectl apply` |

### Відхилення від загальних конвенцій

Немає. Домен — односкладовий (покритий wildcard `*.thesis-i.com`, на відміну
від `butiktoys-pos`), а `typescript.ignoreBuildErrors: true` в
`next.config.ts` лишений як у загальному шаблоні (§3): CI-крок `typecheck`
все одно ловить помилки типів до збірки образу.

---

## 1. Перелік манифестів (`k8s/`)

| Файл | Що створює | Нотатки |
|------|-----------|---------|
| `namespace.yaml` | `Namespace personal-crm` | |
| `secret.example.yaml` | шаблон `Secret` | **не** застосовувати напряму — див. §3 |
| `postgres.yaml` | `StatefulSet` + headless `Service` + PVC 5Gi | видалити, якщо підключаєтесь до наявного Postgres |
| `deployment.yaml` | `Deployment` застосунку + 2 initContainers | `strategy: Recreate`, non-root (стандартний Next.js non-root user з Dockerfile) |
| `service.yaml` | `Service personal-crm` (ClusterIP:3000) | |
| `ingress.yaml` | `Ingress` (Traefik) | односкладовий хост, TLS без нюансів |
| `argocd-app.yaml` | `Application` в `argocd` | застосовується один раз вручну |

Немає окремого `configmap.yaml` — на відміну від `butiktoys-pos`, тут немає
несекретних фіче-флагів; `NODE_ENV`, `AUTH_URL`, `AUTH_TRUST_HOST` прописані
прямо в `deployment.yaml`.

### Підключення до вже наявного Postgres

Замість in-cluster інстансу:

1. Видалити `k8s/postgres.yaml`.
2. У Secret вказати зовнішній `DATABASE_URL`.
3. У `deployment.yaml` прибрати initContainer `wait-for-db` **або** замінити
   в ньому хост `personal-crm-postgres` на реальний.
4. База `personal_crm` має існувати — Prisma застосує міграції, але саму БД
   не створює.

Внутрішня адреса (за загальною конвенцією):
```
postgresql://personal_crm:<pass>@personal-crm-postgres.personal-crm.svc.cluster.local:5432/personal_crm?schema=public
```

---

## 2. Змінні середовища в Secret

`personal-crm-secret` (namespace `personal-crm`):

| Ключ | Призначення |
|------|------------|
| `DATABASE_URL` | повний DSN Postgres (пароль має збігатися з `POSTGRES_PASSWORD`) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD` | споживаються Postgres StatefulSet і initContainer `wait-for-db` |
| `OPENAI_API_KEY` | ключ для `gpt-4o-mini` (Structured Outputs) — https://platform.openai.com/api-keys |
| `AUTH_SECRET` | ключ шифрування Auth.js JWT-сесії, `openssl rand -base64 32`; ротація = вихід усіх користувачів із сесії |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | SMTP для листів підтвердження email. Для Gmail — App Password (https://myaccount.google.com/apppasswords), не пароль акаунту |
| `ADMIN_EMAILS` | comma-separated allowlist для `/admin` (див. §5c). **Не** колонка в БД — навмисно: env var неможливо переписати через жоден HTTP-роут, тож самопризначення прав неможливе структурно |

`AUTH_URL`, `AUTH_TRUST_HOST` і `APP_URL` — несекретні, прописані прямо в
`deployment.yaml` (Auth.js за Traefik-проксі потребує `trustHost`, інакше
кидає `UntrustedHost` у проді; `APP_URL` — база для лінка підтвердження email).

```bash
cp k8s/secret.example.yaml k8s/secret.yaml    # k8s/secret.yaml у .gitignore
```

Заповнити реальні значення, потім запечатати (як у §4 загальної частини):

```bash
kubeseal --format yaml --controller-name=sealed-secrets-controller --controller-namespace=kube-system < k8s/secret.yaml > k8s/sealed-secret.yaml
```

Комітити **лише** `k8s/sealed-secret.yaml`.

---

## 3. Збірка і push образів

CI (`.github/workflows/docker-build.yml`) збирає **два** образи з одного
`Dockerfile` (різні `--target`) і пінує обидва теги в `k8s/deployment.yaml`:

| Target | Образ | Роль |
|--------|-------|------|
| `runner` | `ghcr.io/nulp-ai-enterprise/personal-crm` | застосунок (`output: standalone`, non-root) |
| `migrator` | `ghcr.io/nulp-ai-enterprise/personal-crm-migrator` | Prisma CLI + міграції для initContainer |

Вручну (якщо без CI):

```bash
export ORG=nulp-ai-enterprise TAG=sha-$(git rev-parse --short=7 HEAD)
```

```bash
docker build --target runner   -t ghcr.io/$ORG/personal-crm:$TAG          .
```

```bash
docker build --target migrator -t ghcr.io/$ORG/personal-crm-migrator:$TAG .
```

```bash
docker push ghcr.io/$ORG/personal-crm:$TAG && docker push ghcr.io/$ORG/personal-crm-migrator:$TAG
```

---

## 4. Міграції БД при деплої

Той самий підхід, що й у `butiktoys-pos` (§6 загальної частини): **два
initContainers** у `deployment.yaml`, не окремий Job.

1. **`wait-for-db`** (`postgres:16-alpine`) — цикл `pg_isready`, поки
   Postgres StatefulSet ще піднімається при першій установці.
2. **`migrate`** (образ `*-migrator`) — `npx prisma migrate deploy`.

`strategy: Recreate` — щоб два поди різних версій ніколи не працювали
одночасно проти однієї БД. Порожня БД піднімається з нуля автоматично при
першому деплої.

### Виправлено: дублювання `ContactConnection` у міграціях

Знайдено перед додаванням email-верифікації — щоб не повернулось.
`ContactConnection` в якийсь момент потрапила в БД повз `prisma migrate`
(ймовірно через `db push`), і `prisma/migrations/20260804084838_init/migration.sql`
згодом вручну відредагували, щоб включити її туди задля усунення drift.
Паралельно був створений **окремий** файл миграції, який теж створював
`ContactConnection` — тобто `migrate deploy` на чистій базі падав би на
кроці другої миграції з `relation "ContactConnection" already exists`.

Виправлення: `ContactConnection` лишається лише в `init`; нова миграція
`20260805110000_add_email_verification` містить **тільки**
`EmailVerificationToken` та `User.emailVerified`. Якщо знову з'явиться
drift-помилка від `prisma migrate dev` — не створювати нову миграцію,
що дублює вже наявні таблиці; спочатку перевірити
`grep -c ContactConnection prisma/migrations/*/migration.sql`.

---

## 5. AI-обробка нотаток (`gpt-4o-mini`)

`POST /api/process-interaction` викликає OpenAI **синхронно** в request
path — відповідь ендпоінту прямо залежить від латентності/доступності
OpenAI API. Це навмисно (нотатка обробляється за секунди, окрема черга не
потрібна для персонального інструменту), але важливо для діагностики:

- Повільний OpenAI ⇒ повільний Quick Add, а не зламаний под.
- `OPENAI_API_KEY` невалідний або без квоти ⇒ ендпоінт повертає `500` з
  повідомленням "Не вдалося обробити нотатку", под лишається healthy
  (health-check перевіряє лише Postgres, не OpenAI — так само, як
  `butiktoys-pos` свідомо не перевіряє MinIO в §7 загальної частини).

## 5a. Підтвердження email (сувора перевірка)

Реєстрація **не** логінить користувача одразу. Замість цього:

1. Створюється `User` з `emailVerified = null`.
2. Генерується токен у таблиці `EmailVerificationToken` (TTL 24 год) і
   надсилається лист через SMTP з лінком `${APP_URL}/verify-email?token=...`.
3. Вхід (`authorize()` в `src/lib/auth.ts`) відмовляє, якщо
   `emailVerified` — `null`, навіть з правильним паролем. UI показує
   повідомлення й кнопку "Надіслати лист повторно".

Якщо SMTP недоступний під час реєстрації (таймаут, невірні креденшли) —
акаунт **все одно створюється**; користувач просто натискає "надіслати
повторно" пізніше. Реєстрація ніколи не блокується через SMTP.

Health-check не перевіряє SMTP (так само, як не перевіряє OpenAI) — і Gmail,
і OpenAI — зовнішні залежності, недоступність яких не повинна знімати под з
трафіку.

## 5b. MCP-сервер для AI-асистентів (Claude / ChatGPT / Gemini)

`POST|GET|DELETE /api/mcp` — Model Context Protocol сервер, що дає зовнішньому
AI-асистенту ті самі можливості, що й веб-UI (contacts/companies/communities/
connections CRUD, `process_interaction`, таймлайн/follow-up запити),
автентифікований через **API-ключ**, а не сесію.

**Ніякого нового k8s-ресурсу** — той самий образ, той самий under, той самий
`personal-crm-secret`. Єдина інфраструктурна зміна — новий прямий dependency
`@modelcontextprotocol/sdk` у `package.json` (Docker-білд підхоплює його
автоматично через `npm install`, окремих кроків не потрібно).

Ключова відмінність від решти застосунку: **stateless** — кожен виклик сам
себе автентифікує через `Authorization: Bearer <ключ>`
(`src/lib/mcp/auth.ts`), тому новий `McpServer` створюється на кожен HTTP-
запит (`src/lib/mcp/server.ts`), а не живе між запитами. Узгоджується з тим,
що й так весь застосунок — один под, `strategy: Recreate`, in-memory
rate-limiter (`src/lib/rate-limit.ts`) без координації між репліками.

- **Ключі** — модель `ApiKey` (`prisma/schema.prisma`): зберігається лише
  SHA-256 хеш, сирий ключ (`nxs_...`) показується один раз при створенні.
  Керування — сторінка `/settings` (сесія, не MCP — ключі не можна
  створювати/відкликати через сам MCP, інакше протікла копія плодила б собі
  заміну і робила відкликання марним).
- **`scope`** (`READ` / `READ_WRITE`) визначає, чи взагалі зареєстровані
  write-інструменти для цього ключа — не просто runtime-перевірка, ключ з
  `READ` навіть не бачить їх у `tools/list`.
- **`redactSensitive`** (типово `true`) приховує в результатах інструментів
  телефон/соцмережі/локацію контакту, AI-судження (`temperament/needs/
  valuePotential/fullSummary`) і `Interaction.rawText` — це реальні дані
  третіх осіб, які йдуть до зовнішнього AI-вендора при кожному виклику
  інструменту, тож типова поведінка — приховати їх.
- Rate limit: `mcpToolCall` (60/хв), ключується по `apiKeyId`, а не по IP —
  легітимний клієнт дзвонить з IP вендора, а протеклий ключ, використаний з
  нового IP, все одно має бути обмежений.

**Підключення** — приклад `.mcp.json` (у корені репо, без секрету всередині):

```json
{
  "mcpServers": {
    "nexus-crm": {
      "type": "http",
      "url": "https://personal-crm.thesis-i.com/api/mcp",
      "headers": { "Authorization": "Bearer ${NEXUS_MCP_API_KEY}" }
    }
  }
}
```

`NEXUS_MCP_API_KEY` — локальна змінна середовища користувача (не комітиться),
значення — сирий ключ зі сторінки `/settings`. Claude Desktop/Code — пряма
підтримка через `.mcp.json`/Custom Connector. ChatGPT/Gemini додають
підтримку remote MCP поступово — перевіряти актуальну документацію
провайдера перед підключенням, а не покладатись на цей опис.

## 5b-1. OAuth 2.1 для Claude web/mobile/desktop ("Connect")

Статичний Bearer-ключ (§5b) чудово працює для Claude Code/Desktop через
`.mcp.json`, але кастомний конектор у Claude web/mobile побудований навколо
кнопки "Connect" (OAuth) — статичний заголовок там доступний лише в беті й
не всім. Тому застосунок додатково працює як OAuth 2.1 + PKCE-сервер
авторизації для того самого `/api/mcp`.

**Без Dynamic Client Registration** — користувач створює один
`OAuthClient` на сторінці `/settings` (модель `OAuthClient`,
`prisma/schema.prisma`), вставляє `client_id`/`client_secret` у Advanced
Settings при додаванні кастомного конектора в Claude. Redirect URI не
вводиться вручну — `src/lib/mcp/oauth.ts`'s `ALLOWED_REDIRECT_URIS` містить
жорстко прописані домени Claude (`https://claude.ai/api/mcp/auth_callback`,
`https://claude.com/api/mcp/auth_callback`), бо реальний споживач сьогодні
рівно один.

- **Флоу**: `GET /oauth/authorize` (сторінка згоди, потребує сесії — інакше
  редірект на `/login?callbackUrl=...`) → `POST /api/oauth/authorize`
  (перевірка + видача одноразового коду) → `POST /api/oauth/token`
  (обмін коду на пару access+refresh, з PKCE-перевіркою).
- **Access-токен — це `ApiKey`-рядок** (`generateApiKey()` з
  `src/lib/mcp/auth.ts`), просто з `oauthClientId` і TTL 1 година — MCP-роут
  (`src/app/api/mcp/route.ts`) не потребує жодних змін для розпізнавання
  таких токенів. `listApiKeys()` фільтрує `oauthClientId: null`, інакше
  ротація refresh-токена (~щогодини) захаращувала б список ключів у Settings.
- **Refresh-токен** (`OAuthRefreshToken`, 90 днів) ротується атомарно —
  одна interactive-транзакція видаляє старий і створює нову пару лише якщо
  все валідно; невдала спроба не "спалює" робочий токен користувача.
- **Відкликання каскадне**: `DELETE /api/oauth-clients/[id]` в одній
  транзакції ставить `revokedAt` клієнту, видаляє всі його refresh-токени й
  ставить `revokedAt` усім його `ApiKey`-рядкам — розрив зв'язку в UI справді
  розриває доступ негайно, а не просто ховає рядок зі списку.
- **Discovery**: `/.well-known/oauth-authorization-server` і
  `/.well-known/oauth-protected-resource` — не буквальна `app/.well-known/`
  директорія (непідтверджена поведінка в App Router), а `rewrites()` у
  `next.config.ts` на звичайні роути під `src/app/api/well-known/`.

## 5c. Адмінка (`/admin`)

Перегляд і CRUD-редагування даних **будь-якого** користувача — Contacts
(повний CRUD), Companies/Communities (CRUD), Connections (лише перегляд +
видалення). Єдиний виняток за весь застосунок від правила "юзер бачить лише
своє".

- **Хто адмін** — виключно `ADMIN_EMAILS` (env var, §2), **не** колонка в БД.
  Колонку може переписати будь-який майбутній код-шлях, що оновлює `User`;
  env var не можна переписати через жоден HTTP-роут — самопризначення прав
  структурно неможливе.
- **Захист у два шари**: `src/app/admin/layout.tsx` (`notFound()` для
  залогіненого не-адміна — не 403, щоб не підтверджувати існування роуту) +
  окрема перевірка на початку **кожного** `/api/admin/**` роуту
  (`requireAdminApi()`) — роут-хендлери не є дітьми `layout`, тож самого
  layout-гейту не досить.
- **`src/lib/data/admin.ts`** — єдине місце з навмисно не-scoped (без
  `userId`-фільтру) запитами; імпорт звідти поза `src/app/admin/**` —
  `eslint` error (`eslint.config.mjs`), а не лише ризик пропустити на review.
- **`AdminAuditLog`** — пишеться на кожен запис (create/update/delete), не на
  читання. Дет UI-в'юера немає — дивитись через Prisma Studio.
- **Свідомо поза межами**: `ApiKey`/токени verification/reset ніде не
  читаються й не показуються (доступ до них — не "більше даних", а account
  takeover); імперсонація/bulk-операції/видалення акаунту цілком.
- **Пастка при деплої без downtime**: якщо процес застосунку живе довше, ніж
  міграція, що додає нову Prisma-модель (як `AdminAuditLog`), singleton
  `PrismaClient` (`src/lib/prisma.ts`) лишається зі старою згенерованою
  схемою в пам'яті — виклики до нової моделі впадуть `undefined`, доки под не
  перезапуститься. У k8s це вирішується самим деплой-циклом (новий под = новий
  процес); у локальній розробці — просто перезапустити `next dev` після
  `prisma migrate dev`.

## 6. Health check

`GET /api/health` — відкритий (без сесії):

```json
{ "status": "ok", "database": "up", "timestamp": "..." }
```

`200` — БД відповідає; `503` — ні.

| Probe | Налаштування | Призначення |
|-------|-------------|-------------|
| `startupProbe` | `failureThreshold: 12`, `periodSeconds: 10` | до 2 хв на старт |
| `livenessProbe` | `periodSeconds: 30` | перезапуск при залипанні |
| `readinessProbe` | `periodSeconds: 10` | не пускати трафік без БД |

---

## 7. Перший деплой — покроково

```bash
# 1. Переконатись, що код лежить у корені репозиторію personal-crm

# 2. Заповнити і запечатати Secret
cp k8s/secret.example.yaml k8s/secret.yaml && $EDITOR k8s/secret.yaml
kubectl config set-cluster nulp-k8s-2 --server=https://100.107.206.16:6443
kubeseal --format yaml --controller-name=sealed-secrets-controller --controller-namespace=kube-system < k8s/secret.yaml > k8s/sealed-secret.yaml

# 3. ghcr-secret у новому namespace (один раз)
kubectl create namespace personal-crm
kubectl create secret docker-registry ghcr-secret \
  --namespace=personal-crm \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-pat-with-read-packages>

# 4. Зареєструвати в ArgoCD (один раз)
kubectl apply -f k8s/argocd-app.yaml

# 5. Пуш — CI збере обидва образи і запінує теги
git add . && git commit -m "feat: personal-crm initial deployment" && git push

# 6. Перевірити
kubectl get pods -n personal-crm
kubectl logs -n personal-crm deploy/personal-crm -c migrate
curl -sS https://personal-crm.thesis-i.com/api/health
```

---

## 8. Чекліст (додатково до загального в §7)

- [ ] Код лежить у корені репо `personal-crm`
- [ ] Пароль у `DATABASE_URL` збігається з `POSTGRES_PASSWORD`
- [ ] `OPENAI_API_KEY` дійсний і має квоту на `gpt-4o-mini`
- [ ] `AUTH_SECRET` ≥ 32 символи, згенерований випадково (`openssl rand -base64 32`)
- [ ] `SMTP_USERNAME`/`SMTP_PASSWORD` — Gmail App Password, не пароль акаунту
- [ ] `k8s/secret.yaml` не закомічений, `k8s/sealed-secret.yaml` — закомічений
- [ ] Обидва теги образів (`personal-crm` і `-migrator`) вказують на один SHA
- [ ] StorageClass кластера підтримує `ReadWriteOnce` для PVC Postgres

---

## 9. Діагностика (специфіка застосунку)

```bash
# Логи міграції — найчастіше джерело падінь при першому старті
kubectl logs -n personal-crm deploy/personal-crm -c migrate
kubectl logs -n personal-crm deploy/personal-crm -c wait-for-db

# Застосунок
kubectl logs -n personal-crm deploy/personal-crm -c personal-crm --tail=100

# Які міграції вже застосовані
kubectl exec -n personal-crm personal-crm-postgres-0 -- \
  psql -U personal_crm -d personal_crm -c \
  'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;'
```

| Симптом | Причина | Виправлення |
|---------|---------|-------------|
| Pod у `Init:0/2`, довго | Postgres ще піднімається або PVC не забіндився | `kubectl get pvc -n personal-crm`, `kubectl describe pod` |
| `Init:Error` на `migrate` | `DATABASE_URL` не збігається з `POSTGRES_PASSWORD`, або БД не існує | перевірити Secret |
| `503` на `/api/health` | застосунок не бачить Postgres | перевірити Service `personal-crm-postgres` і DSN |
| Quick Add постійно падає з 500 | `OPENAI_API_KEY` невалідний/без квоти | `kubectl logs ... -c personal-crm \| grep process-interaction`, перевірити ключ на platform.openai.com |
| Після логіну одразу редіректить на `/login` | `AUTH_SECRET` змінився або `AUTH_TRUST_HOST` не `"true"` за проксі | перевірити Secret і env у `deployment.yaml` |
| Голосовий ввід не працює | браузер без підтримки Web Speech API (не Chromium) | очікувана поведінка — кнопка мікрофону просто не рендериться |
| `Постійний OutOfSync` на StatefulSet | дефолти `volumeClaimTemplates` | `ignoreDifferences` уже є в `argocd-app.yaml` |
| Лист підтвердження не приходить | невірний `SMTP_PASSWORD` (потрібен Gmail App Password), або лист у спамі | `kubectl logs ... -c personal-crm \| grep -i "verification email"`; перевірити https://myaccount.google.com/apppasswords |
| Вхід відмовляє з "підтвердіть email" після кліку на лінк | токен застарів (TTL 24 год) або вже використаний | натиснути "надіслати повторно" на сторінці входу |
| `Init:Error` при повторному застосуванні миграцій, `relation already exists` | дубльована миграція створює таблицю, що вже є в `init` | див. підрозділ "Виправлено" в §4 — `grep -c <Table> prisma/migrations/*/migration.sql` |
