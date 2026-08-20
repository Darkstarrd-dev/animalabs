package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

func runKill(args []string) {
	fs := flag.NewFlagSet("kill", flag.ExitOnError)
	port := fs.String("port", "", "port to free (default all anima ports: ANIMA_PORT / 8765)")
	_ = fs.Parse(args)
	targetPort := *port
	if targetPort == "" {
		if p := os.Getenv("ANIMA_PORT"); p != "" {
			targetPort = p
		} else {
			targetPort = "8765"
		}
	}
	killed := 0
	switch runtime.GOOS {
	case "windows":
		killed += killByPortWindows(targetPort)
		killed += killByImageWindows("anima.exe")
	default:
		killed += killByPortUnix(targetPort)
		killed += killByPgrepUnix("anima")
	}
	if killed == 0 {
		fmt.Println("kill: no anima tasks found")
	} else {
		fmt.Printf("kill: terminated %d task(s)\n", killed)
	}
}

func killByPortWindows(port string) int {
	myPid := fmt.Sprintf("%d", os.Getpid())
	out, _ := exec.Command("netstat", "-ano").Output()
	lines := strings.Split(string(out), "\n")
	killed := 0
	seen := map[string]bool{}
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if !strings.Contains(l, ":"+port) || !strings.Contains(strings.ToUpper(l), "LISTENING") {
			continue
		}
		fields := strings.Fields(l)
		if len(fields) < 5 {
			continue
		}
		pid := fields[len(fields)-1]
		if seen[pid] {
			continue
		}
		seen[pid] = true
		if pid == "0" || pid == "4" || pid == myPid {
			continue
		}
		if isAnimaPid(pid) {
			_ = exec.Command("taskkill", "/PID", pid, "/F").Run()
			fmt.Printf("kill port %s pid %s\n", port, pid)
			killed++
		}
	}
	return killed
}

func killByImageWindows(image string) int {
	myPid := fmt.Sprintf("%d", os.Getpid())
	out, _ := exec.Command("tasklist", "/FI", "IMAGENAME eq "+image).Output()
	killed := 0
	for _, l := range strings.Split(string(out), "\n") {
		l = strings.TrimSpace(l)
		if !strings.HasPrefix(strings.ToLower(l), strings.ToLower(image)) {
			continue
		}
		fields := strings.Fields(l)
		if len(fields) < 2 {
			continue
		}
		pid := fields[1]
		if pid == myPid {
			continue
		}
		_ = exec.Command("taskkill", "/PID", pid, "/F").Run()
		fmt.Printf("kill image %s pid %s\n", image, pid)
		killed++
	}
	return killed
}

func killByPortUnix(port string) int {
	killed := 0
	if out, err := exec.Command("lsof", "-ti", ":"+port).Output(); err == nil {
		for _, pid := range strings.Fields(string(out)) {
			_ = exec.Command("kill", "-9", pid).Run()
			fmt.Printf("kill port %s pid %s\n", port, pid)
			killed++
		}
	} else if out, err := exec.Command("fuser", "-k", port+"/tcp").Output(); err == nil {
		_ = out
		killed++
	}
	return killed
}

func killByPgrepUnix(pattern string) int {
	out, _ := exec.Command("pgrep", "-f", pattern).Output()
	killed := 0
	for _, pid := range strings.Fields(string(out)) {
		_ = exec.Command("kill", "-9", pid).Run()
		fmt.Printf("kill pgrep %s pid %s\n", pattern, pid)
		killed++
	}
	return killed
}

func isAnimaPid(pid string) bool {
	out, _ := exec.Command("tasklist", "/FI", "PID eq "+pid).Output()
	s := strings.ToLower(string(out))
	return strings.Contains(s, "anima")
}
