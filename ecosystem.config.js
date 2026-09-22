module.exports = {
  apps: [
    {
      name: "scoobidoo",
      cwd: "/opt/scoobidoo/backend",
      script: "/opt/scoobidoo/backend/.venv/bin/python",
      args: "-m uvicorn main:app --host 127.0.0.1 --port 8010",
      interpreter: "none",
      env: {
        SCOOBIDOO_DATA: "/opt/scoobidoo/data",
      },
    },
  ],
};
