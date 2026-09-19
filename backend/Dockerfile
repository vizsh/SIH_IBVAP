FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Demo mode ships ON by default: a hosted instance has no reachable camera
# to run the real edge pipeline against, so the synthetic generator keeps
# the dashboard alive for evaluators. Local dev overrides this to 0.
ENV IBVAP_DEMO_MODE=1

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
