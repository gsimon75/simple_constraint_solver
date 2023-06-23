# A makeshift constraint solver

## Abstract

When we have some dataset and there are some intrinsic rules by which the members
of this dataset determine each other, we call this a _constraint_.

For example, if we store the sides, the area and the circumference of rectangles,
then we implicitely know that A = a * b and C = 2 * (a + b). If such a constraint
doesn't hold, then that dataset doesn't represent any valid rectangle.

The other aspect of this is the _redundancy_, meaning that if we specify the area
and one side, then there is no need for the other side, as we can compute it:
b = A / a.

Solving a constraint system on some (partial) data means exactly this: to use the
rules to calculate the missing data (if that's possible) or to detect that the
supplied data contradict each other and there aren't any valid solutions.

The cases when we don't have enough data to find a solution is called _underspecified_.
If we have more data than strictly needed, then it's _overspecified_, and of course
if we have just enough data, then it's _(fully) specified_.

With a few variables, like in the case of rectangles, it's easy to just map each
possible combination of what's specified (and provide formulas for the missing data):
 - two sides
 - one side and the area
 - one side and the circumference
 - the area and the circumference

However, as more members enter the system, this grows exponentially and so does the
complexity, and the naïve approach is no longer practical.


## More complex cases

Consider an item on an invoice, like "3 kg of potatoes for a total of 12 AED including 5% VAT".

The dataset that describes this is:
 - name = "potato"
 - unit = "kg"
 - quantity = 3
 - rate = 3.81 (net price for one unit of goods)
 - net amount = 11.43 (= quantity * rate)
 - VAT percentage = 5
 - VAT = 0.57 (= net amount * VAT percentage / 100)
 - gross amount = 12 (= net amount + VAT)
 - currency = "AED"

This is of course heavily overspecified, especially that we may set up _defaults_ for
certain members, in case they are not specified but needed, like:

 - default VAT percentage = 5
 - default quantity = 1

With these, providing any single one of rate, net amount, VAT, gross amount is
completely enough to fully specify the dataset!

If we specify more, like rate=3.81 and net amount=11.43, then we don't even need
the default for quantity, because we can calculate it: quantity = net amount / rate = 3.

However, care must be taken to recognise the invalid, contradictionary datasets, like:
    quantity=3, rate=10 (implies net amount = 30), VAT=10, VAT percentage = 25 (implies net amount = 40)

The calculations, and the order they shall be applied, is trivial _for us humans_, but
when we want to devise an algorithm for it, it becomes rather complex.


## The algorithm

When we describe the system, first we must provide it the rules that calculate certain
data members from other members, like the "net amount = quantity * rate" we already mentioned.

In mathematics, this also implies two other rules: "quantity = net amount / rate" and
"rate = net amount / quantity", but deducting them automatically is beyond the scope of this
basic solver, so now we have to provide them manually.

However, if we have these (and the default values), we indeed have everything we need, and the
algorithm goes like this:

1. If we ran out of applicable rules, then the system is underspecified and we can fail
2. Try all calculation rule:
    - If all its prerequisites are known, then calculate a new member field value
    - If there is already a value for that field, and it's different, then we got an invalid dataset
    - Discard the rule, as it makes no sense to calculate it again in the future
3. Repeat 2 until they solve some new member fields (the number of unknown fields decreases)
4. If the number of unknown fields is 0, then we found a solution and we succeeded
5. Otherwise apply the first default value whose field is still unknown
6. And jump back to 1 and try again


## Implementation

The algorithm is implemented as the `static solve(input)` method of a `class ConstraintSystem`,
which by itself is not usable, as it knows nothing about the domain-specific constraints.

To add these, we shall derive a new descendant `class InvoiceItemConstraintSystem extends ConstraintSystem`,
and define its `static FIELDS = [ "qty", "rate", ... ]`, `static DEFAULTS = { vat_pct: 5, qty: 1, ... }` and of course its

```
static CONSTRAINTS = [
    obj => obj.net_amount = obj.qty * obj.rate,
    ...
];
```

The items in this `CONSTRAINTS` attribute are functions, that take the object as argument,
assign some field of it, **and return its value**.

This is important, as we use this to detect whether the calculation was successful: if it's `NaN`, then it wasn't.

As of using such a ConstraintSystem, it's just a single static method call:

`const result = InvoiceItemConstraintSystem.solve({ rate: 42, vat: 100, ... });`

If the input can be solved, then `result` will be the full solution, otherwise it'll be `false`.

If the input is contradicting itself, then an appropriate `Error` will be thrown.


### A note on the defaults

Their order matters.

Consider this input:
 - vat = 2
 - rate = 10

By itself it's underspecified, but if we bring in a default "qty = 1", then it's fully specified:
 - net amount = rate * qty = 10 * 1 = 10
 - vat percentage = vat / net amount * 100 = 2 / 10 * 100 = 20
 - `result = { qty=1, rate=10, vat_pct=20, vat=2 }`

On the other hand, if we bring in a default "vat percentage = 25", then it gives a different result:
 - net amount = vat * 100 / vat percentage = 2 * 100 / 25 = 8
 - qty = net amount / rate = 8 / 10 = 0.8
 - `result = { qty=0.8, rate=10, vat_pct=25, vat=2 }`


Now suppose that our defaults are exactly these two: `DEFAULTS = { vat_pct: 25, qty: 1 }`

The results we get depends on which of them we use, because it will yield a non-default value for
the other member.

So, the order of the defaults does indeed matter.
