#!/usr/bin/env bash
# setup_vps.sh — configuración inicial del VPS para evitar OOM
# Ejecutar UNA VEZ como root/sudo después de provisionar la instancia.
set -e

echo "=== 1. Swap (4GB adicional si no existe) ==="
if ! swapon --show | grep -q '/swapfile'; then
    if [ ! -f /swapfile ]; then
        sudo fallocate -l 4G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        echo "Swap 4GB creado y activado"
    else
        sudo swapon /swapfile 2>/dev/null && echo "Swap activado" || true
    fi
else
    echo "Swap ya configurado: $(swapon --show | head -2)"
fi

echo "=== 2. vm.swappiness = 10 (swap solo en emergencia) ==="
sudo sysctl -w vm.swappiness=10
grep -q 'vm.swappiness' /etc/sysctl.conf \
    && sudo sed -i 's/vm.swappiness=.*/vm.swappiness=10/' /etc/sysctl.conf \
    || echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

echo "=== Estado de memoria ==="
free -h
awk '/MemAvailable/{printf "RAM disponible: %.0f MB\n", $2/1024}' /proc/meminfo
awk '/SwapFree/{printf "Swap libre:     %.0f MB\n", $2/1024}' /proc/meminfo
echo "Setup completado."
