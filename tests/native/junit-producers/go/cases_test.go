package fixture

import "testing"

func TestPass(t *testing.T)    { t.Log("go pass output") }
func TestFailure(t *testing.T) { t.Error("go fixture failure") }
func TestSkip(t *testing.T)    { t.Skip("go fixture skip") }
