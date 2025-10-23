@test grow_for_testing(["(circle (coord 2 3) 1)"]) == [
    "(circle (coord 2 3) 1)",
    "(intersection (circle (coord 2 3) 1) (circle (coord 2 3) 1))",
    "(mirror (circle (coord 2 3) 1))",
    "(union (circle (coord 2 3) 1) (circle (coord 2 3) 1))"
]
@test grow_for_testing(["(circle (coord 2 3) 1)", "(rect (coord 1 2) (coord 3 4))"]) == [
    "(circle (coord 2 3) 1)",
    "(intersection (circle (coord 2 3) 1) (circle (coord 2 3) 1))",
    "(intersection (circle (coord 2 3) 1) (rect (coord 1 2) (coord 3 4)))",
    "(intersection (rect (coord 1 2) (coord 3 4)) (circle (coord 2 3) 1))",
    "(intersection (rect (coord 1 2) (coord 3 4)) (rect (coord 1 2) (coord 3 4)))",
    "(mirror (circle (coord 2 3) 1))",
    "(mirror (rect (coord 1 2) (coord 3 4)))",
    "(rect (coord 1 2) (coord 3 4))",
    "(union (circle (coord 2 3) 1) (circle (coord 2 3) 1))",
    "(union (circle (coord 2 3) 1) (rect (coord 1 2) (coord 3 4)))",
    "(union (rect (coord 1 2) (coord 3 4)) (circle (coord 2 3) 1))",
    "(union (rect (coord 1 2) (coord 3 4)) (rect (coord 1 2) (coord 3 4)))"
]

